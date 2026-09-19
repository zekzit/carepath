"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { pathwayTemplatesApi, type PathwayTemplate } from "@/lib/api/pathway";
import { listVisitSteps, visitsApi, VISIT_STATUSES, type Visit, type VisitStep } from "@/lib/api/visits";

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function lastNDates(n: number): string[] {
  return Array.from({ length: n }, (_, i) => isoDateNDaysAgo(n - 1 - i));
}

function shortDateLabel(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
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

/** Aggregates from the existing visits/visit-steps/pathway-template list
 * endpoints — there is no dedicated reporting endpoint yet, so everything
 * here is computed client-side over `visitsApi.list()` the same way
 * DashboardPage computes its stats over a single day. */
export function ReportsPage() {
  const t = useTranslations("admin");

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitSteps, setVisitSteps] = useState<VisitStep[]>([]);
  const [pathwayTemplates, setPathwayTemplates] = useState<PathwayTemplate[]>([]);
  const [rangeDays, setRangeDays] = useState<RangeDays>(7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [visitsData, stepsData, templatesData] = await Promise.all([
          visitsApi.list(),
          listVisitSteps(),
          pathwayTemplatesApi.list(),
        ]);
        if (cancelled) return;
        setVisits(visitsData);
        setVisitSteps(stepsData);
        setPathwayTemplates(templatesData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rangeStart = isoDateNDaysAgo(rangeDays - 1);
  const rangeVisits = useMemo(() => visits.filter((v) => v.visit_date >= rangeStart), [visits, rangeStart]);

  const totalVisits = rangeVisits.length;
  const completedVisits = rangeVisits.filter((v) => v.status === "COMPLETED");
  const cancelledCount = rangeVisits.filter((v) => v.status === "CANCELLED").length;
  const completionRate = totalVisits > 0 ? Math.round((completedVisits.length / totalVisits) * 100) : null;

  const doneStepCountByVisit = useMemo(() => {
    const rangeVisitIds = new Set(rangeVisits.map((v) => v.id));
    const map = new Map<number, number>();
    for (const step of visitSteps) {
      if (step.status === "DONE" && rangeVisitIds.has(step.visit)) {
        map.set(step.visit, (map.get(step.visit) ?? 0) + 1);
      }
    }
    return map;
  }, [visitSteps, rangeVisits]);
  const avgStepsPerVisit =
    completedVisits.length > 0
      ? (completedVisits.reduce((sum, v) => sum + (doneStepCountByVisit.get(v.id) ?? 0), 0) / completedVisits.length).toFixed(1)
      : null;

  const visitsPerDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const visit of rangeVisits) {
      counts.set(visit.visit_date, (counts.get(visit.visit_date) ?? 0) + 1);
    }
    return lastNDates(rangeDays).map((date) => ({ date, count: counts.get(date) ?? 0 }));
  }, [rangeVisits, rangeDays]);
  const maxPerDay = Math.max(1, ...visitsPerDay.map((d) => d.count));

  const byTemplate = useMemo(() => {
    const counts = new Map<number, number>();
    for (const visit of rangeVisits) {
      counts.set(visit.pathway_template, (counts.get(visit.pathway_template) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([templateId, count]) => ({
        templateId,
        name: pathwayTemplates.find((tpl) => tpl.id === templateId)?.name_th ?? `#${templateId}`,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rangeVisits, pathwayTemplates]);
  const maxTemplateCount = Math.max(1, ...byTemplate.map((row) => row.count));

  const byStatus = VISIT_STATUSES.map((status) => ({
    status,
    count: rangeVisits.filter((v) => v.status === status).length,
  }));

  const cards = [
    { label: t("reportsTotalVisits"), value: String(totalVisits) },
    { label: t("reportsCompletionRate"), value: completionRate == null ? "—" : `${completionRate}%` },
    { label: t("reportsCancelledCount"), value: String(cancelledCount) },
    { label: t("reportsAvgStepsPerVisit"), value: avgStepsPerVisit ?? "—" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-2">
        <label className="text-[12.5px] font-medium text-[var(--ink-muted)]">{t("reportsRangeLabel")}</label>
        <div className="flex overflow-hidden rounded-lg border border-[var(--border-subtle)]">
          {RANGE_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRangeDays(days)}
              className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                rangeDays === days ? "bg-[var(--brand-ink)] text-white" : "bg-white text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
              }`}
            >
              {t(days === 7 ? "reportsRange7" : days === 14 ? "reportsRange14" : "reportsRange30")}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <div className="text-[12.5px]">{t("loading")}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {cards.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-[18px]">
                <div className="text-[12px] text-[#7c8f8c]">{stat.label}</div>
                <div className="mt-1.5 text-[26px] font-bold text-[var(--ink)]">{stat.value}</div>
              </div>
            ))}
          </div>

          {totalVisits === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
              <div className="text-[12.5px]">{t("reportsNoData")}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <div className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{t("reportsVisitsPerDayTitle")}</div>
                <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                  {visitsPerDay.map((day) => (
                    <div key={day.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div className="text-[10.5px] font-semibold text-[var(--ink)]">{day.count > 0 ? day.count : ""}</div>
                      <div
                        className="w-full rounded-t-sm bg-[var(--brand-teal)]"
                        style={{ height: `${(day.count / maxPerDay) * 100}%`, minHeight: day.count > 0 ? 3 : 0 }}
                      />
                      <div className="text-[9.5px] text-[var(--ink-faint)]">{shortDateLabel(day.date)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <div className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{t("reportsByStatusTitle")}</div>
                <div className="flex flex-col gap-2.5">
                  {byStatus.map((row) => (
                    <div key={row.status} className="flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${statusBadgeClass(row.status)}`}>
                        {t(`visitStatus.${row.status}` as const)}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--ink)]">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
                <div className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{t("reportsByTemplateTitle")}</div>
                <div className="flex flex-col gap-2.5">
                  {byTemplate.map((row) => (
                    <div key={row.templateId} className="flex items-center gap-3">
                      <div className="w-40 shrink-0 truncate text-[12.5px] text-[var(--ink)]">{row.name}</div>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-app)]">
                        <div
                          className="h-full rounded-full bg-[var(--brand-teal)]"
                          style={{ width: `${(row.count / maxTemplateCount) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 shrink-0 text-right text-[12.5px] font-semibold text-[var(--ink)]">{row.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
