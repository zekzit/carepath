"use client";

import { useTranslations } from "next-intl";
import { DashboardPlaceholderIcon } from "@/components/icons";
import type { Patient, Visit } from "@/lib/api/visits";
import type { PathwayTemplate } from "@/lib/api/pathway";

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

/** Today's-visits list for /admin/visits. A plain table rather than DataTable
 * — rows open the read+action VisitDetail view on click, there's no
 * edit/delete here, so DataTable's built-in add/edit/delete chrome doesn't fit. */
export function VisitsList({
  visits,
  patients,
  pathwayTemplates,
  loading,
  onSelect,
}: {
  visits: Visit[];
  patients: Patient[];
  pathwayTemplates: PathwayTemplate[];
  loading: boolean;
  onSelect: (visit: Visit) => void;
}) {
  const t = useTranslations("admin");

  function patientLabel(patientId: number): string {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? `${patient.full_name} (HN ${patient.hn_code})` : `#${patientId}`;
  }
  function templateLabel(templateId: number): string {
    const template = pathwayTemplates.find((tpl) => tpl.id === templateId);
    return template ? template.name_th : `#${templateId}`;
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
        <div className="text-[12.5px]">{t("loading")}</div>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
        <DashboardPlaceholderIcon width={26} height={26} strokeWidth={1.6} className="text-[#b7cbc7]" />
        <div className="text-[14px] font-semibold">{t("visitsEmptyTitle")}</div>
        <div className="text-[12.5px]">{t("visitsEmptyDescription")}</div>
      </div>
    );
  }

  const sorted = visits.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
            <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colFullName")}</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colPathwayTemplate")}</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colVisitDate")}</th>
            <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("colStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((visit) => (
            <tr
              key={visit.id}
              onClick={() => onSelect(visit)}
              className="cursor-pointer border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-app)]"
            >
              <td className="px-4 py-3">{patientLabel(visit.patient)}</td>
              <td className="px-4 py-3">{templateLabel(visit.pathway_template)}</td>
              <td className="px-4 py-3">{visit.visit_date}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${statusBadgeClass(visit.status)}`}>
                  {t(`visitStatus.${visit.status}` as const)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
