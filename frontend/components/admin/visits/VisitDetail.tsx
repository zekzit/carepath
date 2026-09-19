"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/client";
import { nodesApi, type FacilityNode } from "@/lib/api/facility";
import {
  completeVisitStep,
  listVisitSteps,
  skipVisitStep,
  startVisitStep,
  type Patient,
  type Visit,
  type VisitStep,
} from "@/lib/api/visits";
import type { PathwayTemplate } from "@/lib/api/pathway";
import { AdminStepTimeline } from "./AdminStepTimeline";
import { VisitQrCodeButton } from "./VisitQrCodeButton";
import { VisitLinkButton } from "./VisitLinkButton";

function detailFromError(err: unknown): string | null {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    return String((err.body as Record<string, unknown>).detail);
  }
  return null;
}

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

  async function runAction(stepId: number, action: (id: number) => Promise<VisitStep>) {
    setActionError(null);
    setBusyStepId(stepId);
    try {
      await action(stepId);
      const refreshed = await listVisitSteps(visit.id);
      setSteps(refreshed);
      await onVisitStatusChanged();
    } catch (err) {
      setActionError(detailFromError(err) ?? t("formGenericError"));
    } finally {
      setBusyStepId(null);
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

      {loading ? (
        <div className="text-[12.5px] text-[var(--ink-faint)]">{t("loading")}</div>
      ) : (
        <AdminStepTimeline
          steps={steps}
          servicePointLabel={servicePointLabel}
          busyStepId={busyStepId}
          onStart={(id) => runAction(id, startVisitStep)}
          onComplete={(id) => runAction(id, completeVisitStep)}
          onSkip={(id) => runAction(id, skipVisitStep)}
        />
      )}
    </div>
  );
}
