import { useLocale, useTranslations } from "next-intl";
import type { VisitStepView } from "@/lib/portal-data";
import { CheckCircleIcon, ClockIcon } from "@/components/icons";

function stepName(step: VisitStepView, locale: string) {
  return locale === "th" ? step.nameTh : step.nameEn;
}

type Scale = "default" | "kiosk";

function groupBySequence(steps: VisitStepView[]): VisitStepView[][] {
  const groups = new Map<number, VisitStepView[]>();
  for (const step of steps) {
    const group = groups.get(step.sequenceOrder) ?? [];
    group.push(step);
    groups.set(step.sequenceOrder, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

export function StepTimeline({ steps, scale = "default" }: { steps: VisitStepView[]; scale?: Scale }) {
  const t = useTranslations("patient");
  const locale = useLocale();
  const groups = groupBySequence(steps);
  const dot = scale === "kiosk" ? "h-7 w-7" : "h-[22px] w-[22px]";
  const titleSize = scale === "kiosk" ? "text-[16px]" : "text-[13.5px]";
  const metaSize = scale === "kiosk" ? "text-[13px]" : "text-[11.5px]";

  return (
    <div className="flex flex-col">
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;
        const isParallel = group.length > 1;
        const groupStatus = group.some((s) => s.status === "IN_PROGRESS")
          ? "IN_PROGRESS"
          : group.every((s) => s.status === "DONE")
            ? "DONE"
            : "PENDING";

        return (
          <div key={group.map((s) => s.id).join("-")} className="flex gap-2.5">
            <div className="flex flex-col items-center">
              <StepDot status={groupStatus} className={dot} />
              {!isLast && <div className={`min-h-5 w-0.5 flex-grow ${groupStatus === "DONE" ? "bg-[var(--brand-teal)]" : "bg-[var(--border-subtle)]"}`} />}
            </div>

            {isParallel ? (
              <div className="flex-1 pb-2.5">
                {group.map((step) => (
                  <ParallelStepCard key={step.id} step={step} scale={scale} />
                ))}
              </div>
            ) : (
              <div className="pb-3.5">
                <div className={`${titleSize} font-semibold ${group[0].status === "PENDING" ? "text-[var(--ink-muted)]" : ""}`}>
                  {stepName(group[0], locale)}
                </div>
                <div className={`${metaSize} text-[var(--ink-faint)]`}>
                  {group[0].status === "DONE" && `${t("stepDone")} · ${group[0].completedAtLabel}`}
                  {group[0].status === "IN_PROGRESS" && t("stepInProgress")}
                  {group[0].status === "PENDING" && t("waitingPrereq")}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepDot({ status, className }: { status: VisitStepView["status"]; className: string }) {
  if (status === "DONE") {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal)] ${className}`}>
        <CheckCircleIcon width="60%" height="60%" stroke="#fff" strokeWidth={3} />
      </div>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-amber)] ${className}`}>
        <ClockIcon width="60%" height="60%" stroke="#fff" strokeWidth={2.4} />
      </div>
    );
  }
  return <div className={`shrink-0 rounded-full bg-[var(--border-subtle)] ${className}`} />;
}

function ParallelStepCard({ step, scale }: { step: VisitStepView; scale: Scale }) {
  const t = useTranslations("patient");
  const locale = useLocale();
  const padding = scale === "kiosk" ? "px-4 py-3" : "px-3 py-2.5";
  const titleSize = scale === "kiosk" ? "text-[16px]" : "text-[13.5px]";
  const metaSize = scale === "kiosk" ? "text-[13px]" : "text-[11.5px]";

  if (step.status === "IN_PROGRESS") {
    return (
      <div className={`mb-2 rounded-[10px] border border-[#f1e0b8] bg-[#fdf6ea] ${padding}`}>
        <div className={`${titleSize} font-bold text-[#8a6413]`}>
          {stepName(step, locale)} — {t("stepInProgress")}
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-app)] ${padding}`}>
      <div className={`${titleSize} font-semibold text-[var(--ink-muted)]`}>{stepName(step, locale)}</div>
      <div className={`${metaSize} text-[var(--ink-faint)]`}>{t("parallelNote")}</div>
    </div>
  );
}
