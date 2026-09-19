"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { ALL_STAFF_ROLES, ROLE_META } from "@/lib/roles";
import { MapPinIcon } from "@/components/icons";
import type { CurrentStaffUser } from "@/lib/api/server";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Sidebar({ currentUser }: { currentUser: CurrentStaffUser }) {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <div className="flex w-[272px] shrink-0 flex-col bg-[var(--brand-ink)] text-[#eaf3f1]">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-[22px] py-6">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--brand-ink-soft)]">
          <MapPinIcon width={18} height={18} stroke="#eaf3f1" strokeWidth={2} />
        </div>
        <div>
          <div className="text-[16px] font-bold leading-tight">รพ. ตัวอย่าง</div>
          <div className="text-[11px] leading-tight text-[#8fbdb5]">ระบบนำทางผู้ป่วย · Admin</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-b border-white/10 px-[22px] py-3.5">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-ink-soft)] text-[13px] font-bold">
          {getInitials(currentUser.full_name)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{currentUser.full_name}</div>
          <div className="text-[11px] text-[#8fbdb5]">{ROLE_META[currentUser.role].labelTh}</div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-3 overflow-auto p-3">
        {ADMIN_NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => item.roles.includes(currentUser.role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.id} className="flex flex-col gap-0.5">
              {group.titleTh && (
                <div className="px-3 pb-1 pt-2 text-[10.5px] uppercase tracking-wide text-[#6fa098]">
                  {group.titleTh}
                </div>
              )}
              {visibleItems.map((item) => {
                const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.06] ${
                      isActive ? "bg-white/10" : ""
                    }`}
                  >
                    <Icon width={18} height={18} className="shrink-0 text-[#bfe0da]" />
                    <div className="flex-1">
                      <div className={`text-[14px] ${isActive ? "font-semibold" : "font-medium text-[#dcede9]"}`}>
                        {item.labelTh}
                      </div>
                      <div className="text-[10.5px] text-[#8fbdb5]">{item.labelEn}</div>
                    </div>
                    <div className="flex gap-1">
                      {item.roles.map((role) => (
                        <span
                          key={role}
                          title={ROLE_META[role].labelEn}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: ROLE_META[role].colorVar }}
                        />
                      ))}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1.5 border-t border-white/10 px-[22px] py-3.5">
        <div className="mb-0.5 text-[10px] uppercase tracking-wide text-[#6fa098]">{t("roleLegendTitle")}</div>
        {ALL_STAFF_ROLES.map((role) => (
          <div key={role} className="flex items-center gap-2 text-[10.5px] text-[#9fc4be]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: ROLE_META[role].colorVar }} />
            {ROLE_META[role].labelTh} ({ROLE_META[role].labelEn})
          </div>
        ))}
      </div>
    </div>
  );
}
