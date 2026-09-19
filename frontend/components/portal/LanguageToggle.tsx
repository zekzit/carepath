"use client";

import { usePortalLocale } from "./locale-context";

export function LanguageToggle({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { locale, setLocale } = usePortalLocale();

  const trackClass = variant === "dark" ? "bg-white/10" : "bg-[var(--surface-app)]";
  const activeClass = variant === "dark" ? "bg-[#eaf3f1] text-[var(--brand-ink)]" : "bg-[var(--brand-ink)] text-white";
  const inactiveClass = variant === "dark" ? "text-[#bfe0da]" : "text-[var(--ink-muted)]";

  return (
    <div className={`flex items-center gap-1.5 rounded-full p-1 ${trackClass}`}>
      <button
        type="button"
        onClick={() => setLocale("th")}
        aria-pressed={locale === "th"}
        className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${locale === "th" ? activeClass : inactiveClass}`}
      >
        ไทย
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${locale === "en" ? activeClass : inactiveClass}`}
      >
        EN
      </button>
    </div>
  );
}
