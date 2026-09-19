// Mirrors accounts.StaffUser.role (see MODELS.md § 5). Patients never appear
// here — they authenticate via Visit.qr_token, not an account.
export type StaffRole = "REGISTRAR" | "SERVICE_STAFF" | "ADMIN" | "EXECUTIVE";

export const ROLE_META: Record<StaffRole, { labelTh: string; labelEn: string; colorVar: string }> = {
  REGISTRAR: { labelTh: "เวชระเบียน", labelEn: "Registrar", colorVar: "var(--role-registrar)" },
  SERVICE_STAFF: { labelTh: "ประจำจุดบริการ", labelEn: "Service Staff", colorVar: "var(--role-service-staff)" },
  EXECUTIVE: { labelTh: "ผู้บริหาร", labelEn: "Executive", colorVar: "var(--role-executive)" },
  ADMIN: { labelTh: "ผู้ดูแลระบบ", labelEn: "Admin", colorVar: "var(--role-admin)" },
};

export const ALL_STAFF_ROLES: StaffRole[] = ["REGISTRAR", "SERVICE_STAFF", "EXECUTIVE", "ADMIN"];

// TODO: replace with the signed-in StaffUser's real role once auth lands.
export const CURRENT_ROLE: StaffRole = "ADMIN";
