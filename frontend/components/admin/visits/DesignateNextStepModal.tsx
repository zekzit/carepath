"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { EligibleNextStepOption } from "@/lib/api/visits";

/**
 * Opened when completeVisitStep/skipVisitStep rejects with a 409 (see
 * lib/api/visits.ts::EligibleNextStepsError) — staff picks which of the
 * newly-unlocked follow-up steps the patient is designated to go to next.
 * Every checkbox defaults to checked (FR-09: the patient can pick their own
 * queue order among released parallel branches); staff may uncheck ones
 * they want to hold back. At least one must stay checked to confirm.
 * Styling follows the same modal convention as NodesSection.tsx's QR dialog.
 */
export function DesignateNextStepModal({
  options,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  options: EligibleNextStepOption[];
  busy: boolean;
  error: string | null;
  onConfirm: (selectedIds: number[]) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin");
  const locale = useLocale() as AppLocale;
  const [selected, setSelected] = useState<Set<number>>(new Set(options.map((o) => o.id)));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("designateNextTitle")}
    >
      <div className="flex w-full max-w-[420px] flex-col gap-4 rounded-[20px] bg-white p-5 shadow-2xl">
        <div>
          <div className="text-[16px] font-bold text-[var(--ink)]">{t("designateNextTitle")}</div>
          <div className="mt-1 text-[12.5px] text-[var(--ink-muted)]">{t("designateNextHint")}</div>
        </div>

        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const name = locale === "th" ? option.service_point.name_th : option.service_point.name_en;
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--surface-app)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(option.id)}
                    onChange={() => toggle(option.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{name}</span>
                </div>
                <span className="text-[11.5px] text-[var(--ink-faint)]">
                  {t("designateNextWaitingCount", { count: option.waiting_count })}
                </span>
              </label>
            );
          })}
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[var(--border-subtle)] px-3.5 py-1.5 text-[12.5px] font-medium text-[var(--ink-muted)] disabled:opacity-40"
          >
            {t("designateNextCancel")}
          </button>
          <button
            type="button"
            onClick={() => onConfirm([...selected])}
            disabled={busy || selected.size === 0}
            className="rounded-md bg-[var(--brand-teal)] px-3.5 py-1.5 text-[12.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("designateNextConfirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
