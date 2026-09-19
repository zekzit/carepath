import type { StaffRole } from "@/lib/roles";
import { apiFetch } from "./client";
import { createResourceClient } from "./resource";

export type StaffUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  // write-only on the backend — never present in list/retrieve responses.
  password?: string;
};
export type StaffUserInput = Omit<StaffUser, "id">;

export type ServicePointStaff = {
  id: number;
  staff_user: number;
  service_point: number;
};
export type ServicePointStaffInput = Omit<ServicePointStaff, "id">;

export const staffUsersApi = createResourceClient<StaffUser, StaffUserInput>("/accounts/staff-users");
export const servicePointStaffApi = createResourceClient<ServicePointStaff, ServicePointStaffInput>(
  "/accounts/service-point-staff",
);

/** Read-only — rows are only ever written server-side by accounts.services.log_action
 * (see backend/accounts/services.py), never created through this API. */
export type AuditLogEntry = {
  id: number;
  staff_user: number | null;
  staff_username: string | null;
  action: string;
  target_type: string;
  target_id: number;
  detail: Record<string, unknown> | null;
  created_at: string;
};

/** `GET /accounts/audit-logs` — newest first (backend default ordering). */
export function listAuditLogs(): Promise<AuditLogEntry[]> {
  return apiFetch<AuditLogEntry[]>("/accounts/audit-logs");
}
