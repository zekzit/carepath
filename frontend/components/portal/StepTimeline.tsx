import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { PublicVisitStep, PublicVisitStepStatus } from "@/lib/api/public-visit";
import { serviceStepLocationName } from "@/lib/api/public-visit";
import { CheckCircleIcon, ClockIcon, XIcon } from "@/components/icons";

type Scale = "default" | "kiosk";

// A step's dot/status can be a designated-next PENDING step ("ELIGIBLE" —
// SRS Flow Diagram: ฟ้า/blue = รอดำเนินการ, จุดถัดไปที่เจ้าหน้าที่ระบุให้ไป),
// distinct from a plain not-yet-eligible grey PENDING one. Not part of
// PublicVisitStepStatus itself (that's the raw backend status) — this is a
// derived display-only status.
type DisplayStatus = PublicVisitStepStatus | "ELIGIBLE";

function formatCompletedAt(iso: string | null, locale: AppLocale): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function groupBySequence(steps: PublicVisitStep[]): PublicVisitStep[][] {
  const groups = new Map<number, PublicVisitStep[]>();
  for (const step of steps) {
    const group = groups.get(step.sequence_order) ?? [];
    group.push(step);
    groups.set(step.sequence_order, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, group]) => group);
}

export function StepTimeline({ steps, scale = "default" }: { steps: PublicVisitStep[]; scale?: Scale }) {
  const t = useTranslations("patient");
  const locale = useLocale() as AppLocale;
  const groups = groupBySequence(steps);
  const dot = scale === "kiosk" ? "h-7 w-7" : "h-[22px] w-[22px]";
  const titleSize = scale === "kiosk" ? "text-[16px]" : "text-[13.5px]";
  const metaSize = scale === "kiosk" ? "text-[13px]" : "text-[11.5px]";

  return (
    <div className="flex flex-col">
      {groups.map((group, groupIndex) => {
        const isLast = groupIndex === groups.length - 1;
        const isParallel = group.length > 1;
        // A group's connector/dot is "complete" once nothing in it is left to
        // do (DONE or SKIPPED) — a lone SKIPPED prerequisite still does NOT
        // count as satisfied for the *next* group (that rule lives in the
        // backend's own eligibility check, not here).
        const groupStatus: DisplayStatus = group.some((s) => s.status === "IN_PROGRESS")
          ? "IN_PROGRESS"
          : group.every((s) => s.status === "DONE" || s.status === "SKIPPED")
            ? "DONE"
            : group.some((s) => s.status === "PENDING" && s.is_next)
              ? "ELIGIBLE"
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
                <div
                  className={`${titleSize} font-semibold ${
                    (group[0].status === "PENDING" && !group[0].is_next) || group[0].status === "SKIPPED"
                      ? "text-[var(--ink-muted)]"
                      : ""
                  }`}
                >
                  {serviceStepLocationName(group[0], locale)}
                </div>
                <div className={`${metaSize} text-[var(--ink-faint)]`}>
                  {group[0].status === "DONE" && `${t("stepDone")} · ${formatCompletedAt(group[0].completed_at, locale)}`}
                  {group[0].status === "IN_PROGRESS" && t("stepInProgress")}
                  {group[0].status === "PENDING" && (group[0].is_next ? t("stepEligible") : t("waitingPrereq"))}
                  {group[0].status === "SKIPPED" && t("stepSkipped")}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepDot({ status, className }: { status: DisplayStatus; className: string }) {
  if (status === "DONE") {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--brand-teal)] ${className}`}>
        <CheckCircleIcon width="60%" height="60%" stroke="#fff" strokeWidth={3} />
      </div>
    );
  }
  if (status === "SKIPPED") {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--border-subtle)] ${className}`}>
        <XIcon width="55%" height="55%" stroke="var(--ink-faint)" strokeWidth={3} />
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
  if (status === "ELIGIBLE") {
    // Staff-designated next step, still PENDING — SRS blue (ฟ้า).
    return <div className={`shrink-0 rounded-full bg-[var(--brand-blue)] ${className}`} />;
  }
  return <div className={`shrink-0 rounded-full bg-[var(--border-subtle)] ${className}`} />;
}

function ParallelStepCard({ step, scale }: { step: PublicVisitStep; scale: Scale }) {
  const t = useTranslations("patient");
  const locale = useLocale() as AppLocale;
  const padding = scale === "kiosk" ? "px-4 py-3" : "px-3 py-2.5";
  const titleSize = scale === "kiosk" ? "text-[16px]" : "text-[13.5px]";
  const metaSize = scale === "kiosk" ? "text-[13px]" : "text-[11.5px]";
  const name = serviceStepLocationName(step, locale);

  if (step.status === "IN_PROGRESS") {
    return (
      <div className={`mb-2 rounded-[10px] border border-[#f1e0b8] bg-[#fdf6ea] ${padding}`}>
        <div className={`${titleSize} font-bold text-[#8a6413]`}>
          {name} — {t("stepInProgress")}
        </div>
      </div>
    );
  }
  if (step.status === "DONE") {
    return (
      <div className={`mb-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-app)] ${padding}`}>
        <div className={`${titleSize} font-semibold`}>{name}</div>
        <div className={`${metaSize} text-[var(--ink-faint)]`}>
          {t("stepDone")} · {formatCompletedAt(step.completed_at, locale)}
        </div>
      </div>
    );
  }
  if (step.status === "SKIPPED") {
    return (
      <div className={`mb-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-app)] ${padding}`}>
        <div className={`${titleSize} font-semibold text-[var(--ink-muted)]`}>{name}</div>
        <div className={`${metaSize} text-[var(--ink-faint)]`}>{t("stepSkipped")}</div>
      </div>
    );
  }
  if (step.is_next) {
    // Staff-designated next step, still PENDING — SRS blue (ฟ้า), distinct
    // from a plain not-yet-eligible grey parallel sibling below.
    return (
      <div className={`mb-2 rounded-[10px] border border-[var(--brand-blue)]/40 bg-[var(--brand-blue)]/10 ${padding}`}>
        <div className={`${titleSize} font-semibold text-[var(--ink)]`}>{name}</div>
        <div className={`${metaSize} text-[var(--ink-faint)]`}>{t("stepEligible")}</div>
      </div>
    );
  }

  return (
    <div className={`rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-app)] ${padding}`}>
      <div className={`${titleSize} font-semibold text-[var(--ink-muted)]`}>{name}</div>
      <div className={`${metaSize} text-[var(--ink-faint)]`}>{t("parallelNote")}</div>
    </div>
  );
}
