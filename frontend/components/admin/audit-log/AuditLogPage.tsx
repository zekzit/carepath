"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { listAuditLogs, type AuditLogEntry } from "@/lib/api/accounts";

function actionBadgeClass(action: string): string {
  if (action.includes("DELETE")) return "bg-red-50 text-red-600";
  if (action.includes("CREATE") || action === "LOGIN") return "bg-[#e8f5f0] text-[#1f7a5c]";
  if (action.includes("UPDATE") || action === "START_VISIT_STEP") return "bg-[#fdf6ea] text-[#8a6413]";
  return "bg-[#eef2f1] text-[var(--ink-muted)]";
}

/** Read-only view over accounts.AuditLog (see backend/accounts/services.py's
 * log_action) — currently written from staff login/logout, staff-account
 * CRUD, and visit-step start/complete/skip. Filters client-side since the
 * backend only supports exact action/target_type matches, not full-text
 * search, and this dataset is small at hospital-MVP scale. */
export function AuditLogPage() {
  const t = useTranslations("admin");

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listAuditLogs();
        if (cancelled) return;
        setEntries(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const distinctActions = useMemo(() => Array.from(new Set(entries.map((e) => e.action))).sort(), [entries]);
  const visibleEntries = actionFilter ? entries.filter((e) => e.action === actionFilter) : entries;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="text-[12.5px] font-medium text-[var(--ink-muted)]">{t("auditLogFilterLabel")}</label>
        <select
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--brand-teal)]"
        >
          <option value="">{t("auditLogFilterAll")}</option>
          {distinctActions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <div className="text-[12.5px]">{t("loading")}</div>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-16 text-[#8a9c99]">
          <div className="text-[12.5px]">{t("auditLogEmpty")}</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("auditLogColTime")}</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("auditLogColStaff")}</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("auditLogColAction")}</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("auditLogColTarget")}</th>
                <th className="whitespace-nowrap px-4 py-3 font-semibold">{t("auditLogColDetail")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-faint)]">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{entry.staff_username ?? t("auditLogSystemUser")}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${actionBadgeClass(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-muted)]">
                    {entry.target_type} #{entry.target_id}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[var(--ink-faint)]">
                    {entry.detail ? JSON.stringify(entry.detail) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
