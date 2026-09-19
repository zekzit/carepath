"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { nodesApi, type FacilityNode } from "@/lib/api/facility";
import {
  completeVisitStep,
  insertVisitStep,
  listVisitSteps,
  skipVisitStep,
  startVisitStep,
  type EligibleNextStepsError,
  type Patient,
  type Visit,
  type VisitStep,
} from "@/lib/api/visits";
import type { PathwayTemplate } from "@/lib/api/pathway";
import { AdminStepTimeline } from "./AdminStepTimeline";
import { DesignateNextStepModal } from "./DesignateNextStepModal";
import { InsertUnplannedStepModal } from "./InsertUnplannedStepModal";
import { VisitQrCodeButton } from "./VisitQrCodeButton";
import { VisitLinkButton } from "./VisitLinkButton";

function detailFromError(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    return String((err.body as Record<string, unknown>).detail);
  }
  return null;
}

function isEligibleNextStepsError(err: unknown): err is ApiError & { body: EligibleNextStepsError } {
  return (
    err instanceof ApiError &&
    err.status === 409 &&
    !!err.body &&
    typeof err.body === "object" &&
    Array.isArray((err.body as Record<string, unknown>).eligible_next_steps)
  );
}

/** Pending "complete" or "skip" call waiting on staff to designate which
 * newly-unlocked follow-up step(s) (from the 409's eligible_next_steps) the
 * patient goes to next — see DesignateNextStepModal. */
type PendingDesignation = {
  stepId: number;
  kind: "complete" | "skip";
  options: EligibleNextStepsError["eligible_next_steps"];
};

export function VisitDetail({
  visit,
  patients,
  pathwayTemplates,
  onBack,
  onVisitStatusChanged,
}: {
  visit: Visit;
  patients: Patient[];
  pathwayTemplates: PathwayTemplate[];
  onBack: () => void;
  onVisitStatusChanged: () => void | Promise<void>;
}) {
  const t = useTranslations("admin");
  const [steps, setSteps] = useState<VisitStep[]>([]);
  const [nodes, setNodes] = useState<FacilityNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStepId, setBusyStepId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDesignation, setPendingDesignation] = useState<PendingDesignation | null>(null);
  const [designateBusy, setDesignateBusy] = useState(false);
  const [designateError, setDesignateError] = useState<string | null>(null);
  const [insertModalOpen, setInsertModalOpen] = useState(false);
  const [insertBusy, setInsertBusy] = useState(false);
  const [insertError, setInsertError] = useState<string | null>(null);
  const [insertConfirmation, setInsertConfirmation] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [stepsData, nodesData] = await Promise.all([listVisitSteps(visit.id), nodesApi.list()]);
        if (cancelled) return;
        setSteps(stepsData);
        setNodes(nodesData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visit.id]);

  const patient = patients.find((p) => p.id === visit.patient);
  const pathwayTemplate = pathwayTemplates.find((tpl) => tpl.id === visit.pathway_template);

  function servicePointLabel(nodeId: number): string {
    const node = nodes.find((n) => n.id === nodeId);
    return node ? node.name_th : `#${nodeId}`;
  }

  async function runAction(
    stepId: number,
    kind: "start" | "complete" | "skip",
    action: (id: number) => Promise<VisitStep>,
  ) {
    setActionError(null);
    setBusyStepId(stepId);
    try {
      await action(stepId);
      const refreshed = await listVisitSteps(visit.id);
      setSteps(refreshed);
      await onVisitStatusChanged();
    } catch (err) {
      // complete/skip can reject with a 409 asking staff to designate which
      // newly-unlocked follow-up step(s) the patient goes to next — open the
      // picker instead of surfacing this as a plain error.
      if ((kind === "complete" || kind === "skip") && isEligibleNextStepsError(err)) {
        setPendingDesignation({ stepId, kind, options: err.body.eligible_next_steps });
      } else {
        setActionError(detailFromError(err) ?? t("formGenericError"));
      }
    } finally {
      setBusyStepId(null);
    }
  }

  async function confirmDesignation(selectedIds: number[]) {
    if (!pendingDesignation) return;
    setDesignateBusy(true);
    setDesignateError(null);
    try {
      const apply = pendingDesignation.kind === "complete" ? completeVisitStep : skipVisitStep;
      await apply(pendingDesignation.stepId, selectedIds);
      const refreshed = await listVisitSteps(visit.id);
      setSteps(refreshed);
      await onVisitStatusChanged();
      setPendingDesignation(null);
    } catch (err) {
      setDesignateError(detailFromError(err) ?? t("designateNextError"));
    } finally {
      setDesignateBusy(false);
    }
  }

  async function submitInsertStep(currentStepId: number, servicePointId: number, insertBeforeStepIds: number[]) {
    setInsertBusy(true);
    setInsertError(null);
    try {
      const created = await insertVisitStep(currentStepId, servicePointId, insertBeforeStepIds);
      const refreshed = await listVisitSteps(visit.id);
      setSteps(refreshed);
      setInsertModalOpen(false);
      setInsertConfirmation(t("insertStepAddedConfirmation", { count: created.target_queue_waiting_count }));
      window.setTimeout(() => setInsertConfirmation(null), 4000);
    } catch (err) {
      setInsertError(detailFromError(err) ?? t("formGenericError"));
    } finally {
      setInsertBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <button type="button" onClick={onBack} className="self-start text-[12.5px] font-medium text-[var(--brand-teal)]">
        {t("backToVisits")}
      </button>

      <div className="flex items-start justify-between gap-4 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
        <div>
          <div className="text-[15px] font-semibold text-[var(--ink)]">{patient?.full_name ?? `#${visit.patient}`}</div>
          <div className="text-[12.5px] text-[var(--ink-faint)]">
            HN {patient?.hn_code ?? "—"} · {pathwayTemplate?.name_th ?? `#${visit.pathway_template}`} · {visit.visit_date}
          </div>
          <div className="mt-1 text-[12px] text-[var(--ink-muted)]">
            {t(`visitStatus.${visit.status}` as const)}
            {visit.uses_wheelchair ? ` · ${t("colWheelchair")}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <VisitLinkButton token={visit.qr_token} />
          <VisitQrCodeButton token={visit.qr_token} patientName={patient?.full_name ?? `#${visit.patient}`} hn={patient?.hn_code ?? "—"} />
        </div>
      </div>

      {actionError && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{actionError}</div>}
      {insertConfirmation && (
        <div className="rounded-lg bg-[var(--surface-app)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
          {insertConfirmation}
        </div>
      )}

      {loading ? (
        <div className="text-[12.5px] text-[var(--ink-faint)]">{t("loading")}</div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setInsertModalOpen(true)}
            disabled={steps.length === 0}
            className="self-start rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("insertStepCta")}
          </button>

          <AdminStepTimeline
            steps={steps}
            servicePointLabel={servicePointLabel}
            busyStepId={busyStepId}
            onStart={(id) => runAction(id, "start", startVisitStep)}
            onComplete={(id) => runAction(id, "complete", completeVisitStep)}
            onSkip={(id) => runAction(id, "skip", skipVisitStep)}
          />
        </>
      )}

      {pendingDesignation && (
        <DesignateNextStepModal
          options={pendingDesignation.options}
          busy={designateBusy}
          error={designateError}
          onConfirm={confirmDesignation}
          onCancel={() => {
            setPendingDesignation(null);
            setDesignateError(null);
          }}
        />
      )}

      {insertModalOpen && (
        <InsertUnplannedStepModal
          visitSteps={steps}
          defaultCurrentStepId={steps.find((s) => s.status === "IN_PROGRESS")?.id ?? steps[0]?.id ?? null}
          servicePointNodes={nodes.filter((n) => n.node_type === "SERVICE_POINT")}
          servicePointLabel={servicePointLabel}
          busy={insertBusy}
          error={insertError}
          onSubmit={submitInsertStep}
          onCancel={() => {
            setInsertModalOpen(false);
            setInsertError(null);
          }}
        />
      )}
    </div>
  );
}
