"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FacilityNode } from "@/lib/api/facility";
import type { VisitStep } from "@/lib/api/visits";

/**
 * FR-20: staff inserts an unplanned step mid-visit (e.g. a doctor ordering
 * an extra chest X-ray) without breaking existing prerequisite ordering.
 * `currentStep` is where staff is standing right now — the new step's sole
 * prerequisite (see backend/visits/viewsets.py::VisitStepViewSet.insert_next).
 * Any already-pending step that must now wait for the new step too is
 * chained automatically server-side — staff no longer hand-pick targets
 * here. Styling follows the same modal convention as NodesSection.tsx's QR
 * dialog / DesignateNextStepModal.tsx.
 */
export function InsertUnplannedStepModal({
  visitSteps,
  defaultCurrentStepId,
  servicePointNodes,
  servicePointLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  visitSteps: VisitStep[];
  defaultCurrentStepId: number | null;
  servicePointNodes: FacilityNode[];
  servicePointLabel: (nodeId: number) => string;
  busy: boolean;
  error: string | null;
  onSubmit: (currentStepId: number, servicePointId: number, insertBeforeStepIds: number[]) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin");
  const [currentStepId, setCurrentStepId] = useState<number | null>(defaultCurrentStepId);
  const [servicePointId, setServicePointId] = useState<number | null>(servicePointNodes[0]?.id ?? null);

  function handleSubmit() {
    if (currentStepId == null || servicePointId == null) return;
    onSubmit(currentStepId, servicePointId, []);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("insertStepTitle")}
    >
      <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-[20px] bg-white p-5 shadow-2xl">
        <div className="text-[16px] font-bold text-[var(--ink)]">{t("insertStepTitle")}</div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[var(--ink-muted)]">{t("insertStepCurrentStepLabel")}</label>
          <select
            value={currentStepId ?? ""}
            onChange={(e) => setCurrentStepId(Number(e.target.value))}
            className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-[13px]"
          >
            {visitSteps.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.sequence_order} · {servicePointLabel(s.service_point)} ({s.status})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-medium text-[var(--ink-muted)]">{t("insertStepServicePointLabel")}</label>
          <select
            value={servicePointId ?? ""}
            onChange={(e) => setServicePointId(Number(e.target.value))}
            className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1.5 text-[13px]"
          >
            {servicePointNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name_th}
              </option>
            ))}
          </select>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--border-subtle)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--ink-muted)] disabled:opacity-40"
          >
            {t("insertStepCancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || currentStepId == null || servicePointId == null}
            className="rounded-md bg-[var(--brand-teal)] px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("insertStepSubmit")}
          </button>
        </div>
      </div>
    </div>
  );
}
