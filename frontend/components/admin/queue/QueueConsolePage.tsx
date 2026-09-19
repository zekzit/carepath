"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { nodesApi, type FacilityNode } from "@/lib/api/facility";
import {
  callNextTicket,
  doneTicket,
  listQueueTickets,
  listQueuesByServicePoint,
  serveTicket,
  type Queue,
  type QueueTicket,
} from "@/lib/api/queues";
import { listVisitSteps, patientsApi, visitsApi, type Patient, type Visit, type VisitStep } from "@/lib/api/visits";

function detailFromError(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    return String((err.body as Record<string, unknown>).detail);
  }
  return null;
}

async function fetchLookupData() {
  // Cross-reference data for "whose ticket is this" (visit_step -> visit ->
  // patient), fetched once into local state rather than waterfalling a fetch
  // per ticket — same approach Phase 1's NodesSection used for floor/building.
  const [patients, visits, visitSteps] = await Promise.all([patientsApi.list(), visitsApi.list(), listVisitSteps()]);
  return { patients, visits, visitSteps };
}

export function QueueConsolePage() {
  const t = useTranslations("admin");

  const [servicePoints, setServicePoints] = useState<FacilityNode[]>([]);
  const [selectedServicePointId, setSelectedServicePointId] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitSteps, setVisitSteps] = useState<VisitStep[]>([]);

  const [queue, setQueue] = useState<Queue | null>(null);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      try {
        const [nodes, lookups] = await Promise.all([nodesApi.list(), fetchLookupData()]);
        if (cancelled) return;
        const servicePointNodes = nodes.filter((n) => n.node_type === "SERVICE_POINT");
        setServicePoints(servicePointNodes);
        setPatients(lookups.patients);
        setVisits(lookups.visits);
        setVisitSteps(lookups.visitSteps);
        if (servicePointNodes.length > 0) {
          setSelectedServicePointId(servicePointNodes[0].id);
        } else {
          setQueueLoading(false);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Plain async function (not tied to an effect) — called both from the
  // effect below via an async IIFE and directly from the call-next/serve/done
  // action handlers to refresh after a mutation.
  async function refetchQueueData(servicePointId: number) {
    setQueueLoading(true);
    setError(null);
    try {
      const queues = await listQueuesByServicePoint(servicePointId);
      const currentQueue = queues[0] ?? null;
      setQueue(currentQueue);
      if (currentQueue) {
        const ticketList = await listQueueTickets(currentQueue.id);
        setTickets(ticketList.slice().sort((a, b) => a.ticket_number - b.ticket_number));
      } else {
        setTickets([]);
      }
    } finally {
      setQueueLoading(false);
    }
  }

  useEffect(() => {
    if (selectedServicePointId == null) return;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await refetchQueueData(selectedServicePointId);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedServicePointId]);

  function patientNameForTicket(ticket: QueueTicket): string {
    const step = visitSteps.find((s) => s.id === ticket.visit_step);
    const visit = step ? visits.find((v) => v.id === step.visit) : undefined;
    const patient = visit ? patients.find((p) => p.id === visit.patient) : undefined;
    return patient ? `${patient.full_name} (HN ${patient.hn_code})` : "—";
  }

  async function refreshLookups() {
    const lookups = await fetchLookupData();
    setPatients(lookups.patients);
    setVisits(lookups.visits);
    setVisitSteps(lookups.visitSteps);
  }

  async function handleCallNext() {
    if (!queue) return;
    setBusy(true);
    setError(null);
    try {
      await callNextTicket(queue.id);
      await refetchQueueData(queue.service_point);
    } catch (err) {
      setError(detailFromError(err) ?? t("formGenericError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleTicketAction(ticketId: number, action: (id: number) => Promise<QueueTicket>) {
    if (selectedServicePointId == null) return;
    setBusy(true);
    setError(null);
    try {
      await action(ticketId);
      await refetchQueueData(selectedServicePointId);
      // "done" also completes the underlying VisitStep server-side, so the
      // visit-step lookup used for patient-name resolution can go stale —
      // refresh it too (cheap: same small "today" dataset).
      await refreshLookups();
    } catch (err) {
      setError(detailFromError(err) ?? t("formGenericError"));
    } finally {
      setBusy(false);
    }
  }

  const loading = initialLoading || queueLoading;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="text-[12.5px] font-medium text-[var(--ink-muted)]">{t("colServicePoint")}</label>
        <select
          value={selectedServicePointId ?? ""}
          onChange={(event) => setSelectedServicePointId(event.target.value ? Number(event.target.value) : null)}
          disabled={servicePoints.length === 0}
          className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-teal)]"
        >
          {servicePoints.map((servicePoint) => (
            <option key={servicePoint.id} value={servicePoint.id}>
              {servicePoint.name_th}
            </option>
          ))}
        </select>
      </div>

      {!initialLoading && servicePoints.length === 0 && (
        <div className="text-[12.5px] text-[var(--ink-faint)]">{t("noServicePoints")}</div>
      )}

      {selectedServicePointId != null && (
        <>
          <div className="flex items-center justify-between rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
            <div>
              <div className="text-[12px] uppercase tracking-wide text-[var(--ink-faint)]">{t("currentNumberLabel")}</div>
              <div className="text-[32px] font-bold text-[var(--ink)]">{queue ? queue.current_number : "—"}</div>
              {!queue && !queueLoading && <div className="text-[12px] text-[var(--ink-faint)]">{t("noQueueToday")}</div>}
            </div>
            <button
              type="button"
              disabled={!queue || busy}
              onClick={handleCallNext}
              className="rounded-lg bg-[var(--brand-ink)] px-4 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("callNextCta")}
            </button>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</div>}

          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
              <div className="text-[12.5px]">{t("loading")}</div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
              <div className="text-[14px] font-semibold">{t("noTicketsTitle")}</div>
              <div className="text-[12.5px]">{t("noTicketsDescription")}</div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colTicketNumber")}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colFullName")}</th>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colStatus")}</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-4 py-3 font-semibold">{ticket.ticket_number}</td>
                      <td className="px-4 py-3">{patientNameForTicket(ticket)}</td>
                      <td className="px-4 py-3">{t(`ticketStatus.${ticket.status}` as const)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={ticket.status !== "CALLED" || busy}
                            onClick={() => handleTicketAction(ticket.id, serveTicket)}
                            className="rounded-md bg-[var(--brand-teal)] px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {t("ticketActionServe")}
                          </button>
                          <button
                            type="button"
                            disabled={(ticket.status !== "CALLED" && ticket.status !== "SERVING") || busy}
                            onClick={() => handleTicketAction(ticket.id, doneTicket)}
                            className="rounded-md bg-[var(--brand-ink)] px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {t("ticketActionDone")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
