"use client";

import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { findActiveAdminNavItem } from "@/lib/admin-nav";
import { BellIcon } from "@/components/icons";
import { StaffLanguageSwitcher } from "./StaffLanguageSwitcher";
import { LogoutButton } from "./LogoutButton";

export function Topbar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("admin");
  const activeItem = findActiveAdminNavItem(pathname);
  const activeLabel = activeItem ? (locale === "th" ? activeItem.labelTh : activeItem.labelEn) : "";

  return (
    <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-card)] px-8">
      <div>
        <div className="text-[11px] text-[#7c8f8c]">
          {t("breadcrumb")} / {activeLabel}
        </div>
        <div className="text-[18px] font-bold text-[var(--ink)]">{activeLabel}</div>
      </div>
      <div className="flex items-center gap-3.5">
        <StaffLanguageSwitcher />
        <button type="button" aria-label={t("notifications")} className="text-[#5b6e6b]">
          <BellIcon width={20} height={20} />
        </button>
        <LogoutButton />
      </div>
    </div>
  );
}
