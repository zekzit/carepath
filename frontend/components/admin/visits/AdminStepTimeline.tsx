"use client";

import { useTranslations } from "next-intl";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";
import type { VisitStep } from "@/lib/api/visits";

/**
 * Admin-facing step timeline: groups VisitSteps by `sequence_order` (steps
 * sharing a number can run in parallel — same grouping rule as the Patient
 * Portal's StepTimeline.tsx, see MODELS.md § 3), but renders every step with
 * Start/Complete/Skip actions gated by eligibility instead of being read-only.
 * Built fresh rather than reusing StepTimeline.tsx because that component's
 * data shape (VisitStepView, with baked-in nameTh/nameEn) doesn't match the
 * real VisitStep API shape here.
 */

type GroupStatus = "DONE" | "IN_PROGRESS" | "PENDING";

function groupBySequence(steps: VisitStep[]): VisitStep[][] {
  const groups = new Map<number, VisitStep[]>();
  for (const step of steps) {
    const group = groups.get(step.sequence_order) ?? [];
    group.push(step);
    groups.set(step.sequence_order, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

/** A step may start once it's PENDING and every one of its prerequisites (looked
 * up within this same visit's step list) is DONE — a SKIPPED prerequisite does
 * NOT count, per MODELS.md and the backend's tested `start` action. */
function canStart(step: VisitStep, allSteps: VisitStep[]): boolean {
  if (step.status !== "PENDING") return false;
  return step.prerequisite_steps.every((prereqId) => allSteps.find((s) => s.id === prereqId)?.status === "DONE");
}

function canComplete(step: VisitStep): boolean {
  return step.status === "IN_PROGRESS";
}

function canSkip(step: VisitStep): boolean {
  return step.status !== "DONE" && step.status !== "SKIPPED";
}

export function AdminStepTimeline({
  steps,
  servicePointLabel,
  busyStepId,
  onStart,
  onComplete,
  onSkip,
}: {
  steps: VisitStep[];
  servicePointLabel: (nodeId: number) => string;
  busyStepId: number | null;
  onStart: (stepId: number) => void;
  onComplete: (stepId: number) => void;
  onSkip: (stepId: number) => void;
}) {
  const t = useTranslations("admin");
  const groups = groupBySequence(steps);

  if (groups.length === 0) {
    return <div className="text-[12.5px] text-[var(--ink-faint)]">{t("visitStepsEmpty")}</div>;
  }

  return (
    <div className="flex flex-col">
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;
        const groupStatus: GroupStatus = group.some((s) => s.status === "IN_PROGRESS")
          ? "IN_PROGRESS"
          : group.every((s) => s.status === "DONE" || s.status === "SKIPPED")
            ? "DONE"
            : "PENDING";

        return (
          <div key={group.map((s) => s.id).join("-")} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepDot status={groupStatus} />
              {!isLast && (
                <div
                  className={`min-h-6 w-0.5 flex-grow ${groupStatus === "DONE" ? "bg-[var(--brand-teal)]" : "bg-[var(--border-subtle)]"}`}
                />
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 pb-4">
              {group.length > 1 && (
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-faint)]">
                  {t("parallelGroupLabel")} · {t("sequenceOrderLabel")} {group[0].sequence_order}
                </div>
              )}
              {group.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  allSteps={steps}
                  servicePointLabel={servicePointLabel}
                  busy={busyStepId === step.id}
                  onStart={() => onStart(step.id)}
                  onComplete={() => onComplete(step.id)}
                  onSkip={() => onSkip(step.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepDot({ status }: { status: GroupStatus }) {
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full";
  if (status === "DONE") {
    return (
      <div className={`${base} bg-[var(--brand-teal)]`}>
        <CheckCircleIcon width="60%" height="60%" stroke="#fff" strokeWidth={3} />
      </div>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <div className={`${base} bg-[var(--brand-amber)]`}>
        <ClockIcon width="60%" height="60%" stroke="#fff" strokeWidth={2.4} />
      </div>
    );
  }
  return <div className={`${base} bg-[var(--border-subtle)]`} />;
}

function StepCard({
  step,
  allSteps,
  servicePointLabel,
  busy,
  onStart,
  onComplete,
  onSkip,
}: {
  step: VisitStep;
  allSteps: VisitStep[];
  servicePointLabel: (nodeId: number) => string;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations("admin");
  const startEligible = canStart(step, allSteps);
  const completeEligible = canComplete(step);
  const skipEligible = canSkip(step);

  return (
    <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-semibold text-[var(--ink)]">{servicePointLabel(step.service_point)}</div>
          <div className="text-[11.5px] text-[var(--ink-faint)]">
            {t(`visitStepStatus.${step.status}` as const)}
            {!step.is_planned ? ` · ${t("adHocStep")}` : ""}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!startEligible || busy}
            onClick={onStart}
            className="rounded-md bg-[var(--brand-teal)] px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("stepActionStart")}
          </button>
          <button
            type="button"
            disabled={!completeEligible || busy}
            onClick={onComplete}
            className="rounded-md bg-[var(--brand-ink)] px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("stepActionComplete")}
          </button>
          <button
            type="button"
            disabled={!skipEligible || busy}
            onClick={onSkip}
            className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--ink-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("stepActionSkip")}
          </button>
        </div>
      </div>
    </div>
  );
}
