import type { ComponentType } from "react";
import {
  BarChartIcon,
  CalendarIcon,
  GitBranchIcon,
  GridIcon,
  IconProps,
  ListIcon,
  MapIcon,
  SettingsIcon,
  ShieldIcon,
  UserPlusIcon,
  UsersIcon,
} from "@/components/icons";
import type { StaffRole } from "./roles";

export type AdminNavItem = {
  id: string;
  href: string;
  icon: ComponentType<IconProps>;
  labelTh: string;
  labelEn: string;
  /** StaffRole values allowed to see this item — drives the sidebar's role gating. */
  roles: StaffRole[];
};

export type AdminNavGroup = {
  id: string;
  titleTh?: string;
  titleEn?: string;
  items: AdminNavItem[];
};

// Menu skeleton per MODELS.md's five apps (facility / pathway / visits /
// queues / accounts) plus a dashboard and reports view. Content for each
// route is a placeholder for now — see components/admin/PlaceholderContent.
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "main",
    items: [
      {
        id: "dashboard",
        href: "/admin",
        icon: GridIcon,
        labelTh: "ภาพรวม",
        labelEn: "Dashboard",
        roles: ["REGISTRAR", "SERVICE_STAFF", "EXECUTIVE", "ADMIN"],
      },
      {
        id: "visits",
        href: "/admin/visits",
        icon: UserPlusIcon,
        labelTh: "ลงทะเบียน / เยี่ยมผู้ป่วย",
        labelEn: "Registration & Visits",
        roles: ["REGISTRAR", "ADMIN"],
      },
      {
        id: "queue",
        href: "/admin/queue",
        icon: ListIcon,
        labelTh: "คิวบริการ",
        labelEn: "Queue Console",
        roles: ["SERVICE_STAFF", "ADMIN"],
      },
    ],
  },
  {
    id: "config",
    titleTh: "ตั้งค่าระบบ",
    titleEn: "Configuration",
    items: [
      {
        id: "facility",
        href: "/admin/facility",
        icon: MapIcon,
        labelTh: "ผังสถานที่",
        labelEn: "Facility Map",
        roles: ["ADMIN"],
      },
      {
        id: "pathways",
        href: "/admin/pathways",
        icon: GitBranchIcon,
        labelTh: "แม่แบบเส้นทางการรักษา",
        labelEn: "Pathway Templates",
        roles: ["ADMIN"],
      },
      {
        id: "schedule",
        href: "/admin/schedule",
        icon: CalendarIcon,
        labelTh: "ตารางเวลาบริการ",
        labelEn: "Service Schedule",
        // ADMIN-only, matching the SRS API contract's Role column for
        // /api/queues/service-schedules (see backend/queues/viewsets.py's
        // ServiceScheduleViewSet, read_roles=()/write_roles=()) — SERVICE_STAFF
        // used to see this link but got a 403 from every call, since the
        // backend was always meant to be admin-managed opening-hours config.
        roles: ["ADMIN"],
      },
      {
        id: "staff",
        href: "/admin/staff",
        icon: UsersIcon,
        labelTh: "ผู้ใช้งานและสิทธิ์",
        labelEn: "Staff & Roles",
        roles: ["ADMIN"],
      },
      {
        id: "reports",
        href: "/admin/reports",
        icon: BarChartIcon,
        labelTh: "รายงานผู้บริหาร",
        labelEn: "Executive Reports",
        roles: ["EXECUTIVE", "ADMIN"],
      },
      {
        id: "audit-log",
        href: "/admin/audit-log",
        icon: ShieldIcon,
        labelTh: "Audit Log",
        labelEn: "Audit Log",
        roles: ["ADMIN"],
      },
      {
        id: "settings",
        href: "/admin/settings",
        icon: SettingsIcon,
        labelTh: "ตั้งค่าระบบ",
        labelEn: "Settings",
        roles: ["ADMIN"],
      },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

/** Finds the nav item matching the current pathname, longest href first so `/admin/visits/x` still matches `/admin/visits`. */
export function findActiveAdminNavItem(pathname: string): AdminNavItem | undefined {
  return [...ADMIN_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => (item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)));
}
