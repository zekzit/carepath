"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { Kiosk } from "@/lib/api/kiosk";
import { MapPinIcon, SearchIcon } from "@/components/icons";

export function KioskListView({ kiosks }: { kiosks: Kiosk[] }) {
  const t = useTranslations("kiosk");
  const locale = useLocale() as AppLocale;
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return kiosks;
    return kiosks.filter((kiosk) => {
      return (
        kiosk.deviceCode.toLowerCase().includes(needle) ||
        kiosk.nameTh.toLowerCase().includes(needle) ||
        kiosk.nameEn.toLowerCase().includes(needle)
      );
    });
  }, [kiosks, query]);

  return (
    <div className="flex min-h-screen w-full justify-center bg-[var(--surface-app)] p-6">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--ink)]">{t("listTitle")}</h1>
          <p className="text-sm text-[var(--ink-muted)]">{t("listSubtitle")}</p>
        </header>

        <label className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3 shadow-sm focus-within:border-[var(--brand-teal)]">
          <SearchIcon width={18} height={18} stroke="var(--ink-muted)" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("listSearchPlaceholder")}
            className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        </label>

        {kiosks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-10 text-center text-sm text-[var(--ink-muted)]">
            {t("listEmptyAdmin")}
          </div>
        )}

        {kiosks.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-10 text-center text-sm text-[var(--ink-muted)]">
            {t("listEmptySearch")}
          </div>
        )}

        {filtered.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((kiosk) => {
              const displayName = locale === "th" ? kiosk.nameTh : kiosk.nameEn;
              return (
                <li key={kiosk.deviceCode}>
                  <Link
                    href={`/kiosk/${encodeURIComponent(kiosk.deviceCode)}`}
                    className="flex items-center gap-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-3.5 shadow-sm transition-colors hover:border-[var(--brand-teal)] hover:bg-[#eaf5f3]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-ink)]">
                      <MapPinIcon width={20} height={20} stroke="#bfe0da" strokeWidth={1.8} />
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-semibold text-[var(--ink)]">{displayName}</span>
                      <span className="truncate text-[12px] text-[var(--ink-muted)]">
                        {t("listDeviceCodeLabel")}: {kiosk.deviceCode}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
