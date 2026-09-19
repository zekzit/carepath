"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/lib/locale-actions";
import type { AppLocale } from "@/i18n/locales";

export function StaffLanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const [isPending, startTransition] = useTransition();

  function choose(next: AppLocale) {
    if (next === locale || isPending) return;
    startTransition(() => {
      void setLocale(next);
    });
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-[var(--surface-app)] p-1.5">
      <button
        type="button"
        onClick={() => choose("th")}
        aria-pressed={locale === "th"}
        className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${
          locale === "th" ? "bg-[var(--brand-ink)] text-white" : "text-[var(--ink-muted)]"
        }`}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => choose("en")}
        aria-pressed={locale === "en"}
        className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors ${
          locale === "en" ? "bg-[var(--brand-ink)] text-white" : "text-[var(--ink-muted)]"
        }`}
      >
        EN
      </button>
    </div>
  );
}
