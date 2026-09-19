"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardPlaceholderIcon } from "@/components/icons";
import { nodesApi } from "@/lib/api/facility";
import { listQueuesByServicePoint, listQueueTickets, type QueueTicket } from "@/lib/api/queues";
import { pathwayTemplatesApi, type PathwayTemplate } from "@/lib/api/pathway";
import {
  listVisitSteps,
  listVisitsByDate,
  patientsApi,
  VISIT_STATUSES,
  type Patient,
  type Visit,
} from "@/lib/api/visits";
import type { StaffRole } from "@/lib/roles";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusBadgeClass(status: Visit["status"]): string {
  switch (status) {
    case "IN_PROGRESS":
      return "bg-[#fdf6ea] text-[#8a6413]";
    case "COMPLETED":
      return "bg-[#e8f5f0] text-[#1f7a5c]";
    case "CANCELLED":
      return "bg-red-50 text-red-600";
    case "REGISTERED":
    default:
      return "bg-[#eef2f1] text-[var(--ink-muted)]";
  }
}

type DashboardStats = {
  patientsToday: number;
  waitingTickets: number;
  avgWaitMinutes: number | null;
  openServicePoints: number;
  totalServicePoints: number;
};

/** Real numbers computed from today's data rather than fixed placeholders:
 * "waiting" sums live queue tickets (WAITING/CALLED) across every service
 * point's queue for today, and "avg. wait" averages started_at→completed_at
 * across today's DONE visit steps. Both need a per-service-point queue
 * fetch — same N-fetch approach QueueConsolePage already uses, acceptable
 * at this hospital's small service-point count.
 *
 * `includePatientIdentity` gates whether `patientsApi.list()` (REGISTRAR-only
 * per RBAC, and always patient-identifying: full_name/hn_code) is fetched at
 * all. An EXECUTIVE viewing this shared /admin page must never trigger that
 * request over the network — not merely have the result hidden after the
 * fact — so callers pass `false` for that role and this function skips the
 * fetch entirely (see GAP.md FR-24). */
async function loadDashboardData(includePatientIdentity: boolean) {
  const [nodes, todayVisits, allSteps, patients, pathwayTemplates] = await Promise.all([
    nodesApi.list(),
    listVisitsByDate(todayStr()),
    listVisitSteps(),
    includePatientIdentity ? patientsApi.list() : Promise.resolve<Patient[]>([]),
    pathwayTemplatesApi.list(),
  ]);

  const servicePoints = nodes.filter((node) => node.node_type === "SERVICE_POINT");
  const todayVisitIds = new Set(todayVisits.map((visit) => visit.id));
  const todaySteps = allSteps.filter((step) => todayVisitIds.has(step.visit));

  const queueResults = await Promise.all(
    servicePoints.map(async (servicePoint) => {
      const queues = await listQueuesByServicePoint(servicePoint.id);
      const queue = queues[0] ?? null;
      if (!queue) return { open: false, tickets: [] as QueueTicket[] };
      const tickets = await listQueueTickets(queue.id);
      return { open: true, tickets };
    }),
  );

  const openServicePoints = queueResults.filter((result) => result.open).length;
  const waitingTickets = queueResults.reduce(
    (sum, result) => sum + result.tickets.filter((ticket) => ticket.status === "WAITING" || ticket.status === "CALLED").length,
    0,
  );

  const completedDurationsMin = todaySteps
    .filter((step) => step.status === "DONE" && step.started_at && step.completed_at)
    .map((step) => (new Date(step.completed_at as string).getTime() - new Date(step.started_at as string).getTime()) / 60000);
  const avgWaitMinutes =
    completedDurationsMin.length > 0
      ? Math.round(completedDurationsMin.reduce((a, b) => a + b, 0) / completedDurationsMin.length)
      : null;

  const stats: DashboardStats = {
    patientsToday: new Set(todayVisits.map((visit) => visit.patient)).size,
    waitingTickets,
    avgWaitMinutes,
    openServicePoints,
    totalServicePoints: servicePoints.length,
  };

  return { stats, todayVisits, patients, pathwayTemplates };
}

export function DashboardPage({ currentUserRole }: { currentUserRole?: StaffRole }) {
  const t = useTranslations("admin");
  // Defensive default: currentUserRole is always resolved server-side in
  // practice (app/admin/(authenticated)/layout.tsx already redirects
  // unauthenticated visitors before this ever renders), but if it were ever
  // missing we fall back to the pre-existing (non-Executive) behavior
  // rather than guessing at a privacy posture.
  const isExecutive = currentUserRole === "EXECUTIVE";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  // Full set of today's visits (not just the top-5 `recentVisits` slice) —
  // used only for the Executive status breakdown, which counts ALL of
  // today's visits, not just the most recent handful. Carries no patient
  // identity (Visit rows only reference `patient` by id).
  const [todayVisits, setTodayVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pathwayTemplates, setPathwayTemplates] = useState<PathwayTemplate[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const data = await loadDashboardData(!isExecutive);
        if (cancelled) return;
        setStats(data.stats);
        setTodayVisits(data.todayVisits);
        setRecentVisits(
          data.todayVisits
            .slice()
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 5),
        );
        setPatients(data.patients);
        setPathwayTemplates(data.pathwayTemplates);
      } catch {
        // Any API error (a role/permission mismatch on some future fetch,
        // a network hiccup, ...) surfaces as a visible empty/error state
        // instead of leaving the page stuck silently in `loading` forever —
        // previously there was no catch here at all, so a rejected
        // Promise.all (e.g. an EXECUTIVE 403ing on patientsApi.list(), the
        // exact bug this component now avoids by construction) left the
        // page spinning indefinitely with no feedback.
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isExecutive]);

  function patientLabel(patientId: number): string {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? `${patient.full_name} (HN ${patient.hn_code})` : `#${patientId}`;
  }
  function templateLabel(templateId: number): string {
    const template = pathwayTemplates.find((tpl) => tpl.id === templateId);
    return template ? template.name_th : `#${templateId}`;
  }

  const cards = [
    { label: t("statPatientsToday"), value: !stats ? "—" : String(stats.patientsToday) },
    { label: t("statWaiting"), value: !stats ? "—" : String(stats.waitingTickets) },
    {
      label: t("statAvgWait"),
      value: !stats ? "—" : stats.avgWaitMinutes == null ? t("statAvgWaitEmpty") : `${stats.avgWaitMinutes} ${t("statAvgWaitUnit")}`,
    },
    {
      label: t("statOpenPoints"),
      value: !stats ? "—" : `${stats.openServicePoints} / ${stats.totalServicePoints}`,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        {cards.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-[18px]">
            <div className="text-[12px] text-[#7c8f8c]">{stat.label}</div>
            <div className="mt-1.5 text-[26px] font-bold text-[var(--ink)]">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[14px] font-semibold text-[var(--ink)]">
            {isExecutive ? t("dashboardVisitsByStatusTitle") : t("dashboardRecentVisitsTitle")}
          </div>
          {!isExecutive && (
            <Link href="/admin/visits" className="text-[12px] font-medium text-[var(--brand-teal)]">
              {t("dashboardViewAllVisits")}
            </Link>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-[12.5px] text-[var(--ink-faint)]">{t("loading")}</div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-2 py-10 text-[#8a9c99]">
            <DashboardPlaceholderIcon width={24} height={24} strokeWidth={1.6} className="text-[#b7cbc7]" />
            <div className="text-[12.5px]">{t("dashboardLoadError")}</div>
          </div>
        ) : isExecutive ? (
          // Executives never see patient identity (full_name/hn_code) — no
          // patient lookup even happens for this role (see
          // loadDashboardData's includePatientIdentity flag above). This
          // status breakdown counts ALL of today's visits (not just the
          // top-5 `recentVisits` slice), carrying no patient-identifying
          // information at all — Visit rows only reference `patient` by id.
          todayVisits.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-[#8a9c99]">
              <DashboardPlaceholderIcon width={24} height={24} strokeWidth={1.6} className="text-[#b7cbc7]" />
              <div className="text-[12.5px]">{t("dashboardNoVisitsToday")}</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {VISIT_STATUSES.map((status) => {
                const count = todayVisits.filter((v) => v.status === status).length;
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${statusBadgeClass(status)}`}>
                      {t(`visitStatus.${status}` as const)}
                    </span>
                    <span className="text-[13px] font-semibold text-[var(--ink)]">{count}</span>
                  </div>
                );
              })}
            </div>
          )
        ) : recentVisits.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-[#8a9c99]">
            <DashboardPlaceholderIcon width={24} height={24} strokeWidth={1.6} className="text-[#b7cbc7]" />
            <div className="text-[12.5px]">{t("dashboardNoVisitsToday")}</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("colFullName")}</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("colPathwayTemplate")}</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map((visit) => (
                  <tr key={visit.id} className="border-b border-[var(--border-subtle)] last:border-0">
                    <td className="px-3 py-2.5">{patientLabel(visit.patient)}</td>
                    <td className="px-3 py-2.5">{templateLabel(visit.pathway_template)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${statusBadgeClass(visit.status)}`}>
                        {t(`visitStatus.${visit.status}` as const)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
