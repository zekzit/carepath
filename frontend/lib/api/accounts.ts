import type { StaffRole } from "@/lib/roles";
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
