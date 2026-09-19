import { DashboardPage } from "@/components/admin/dashboard/DashboardPage";
import { getCurrentStaffUser } from "@/lib/api/server";

export default async function Page() {
  // Resolved server-side (same helper the authenticated layout already
  // uses to gate /admin/*) so DashboardPage can branch its data-fetching
  // BEFORE any client-side fetch fires — an EXECUTIVE must never trigger a
  // network request for patient records at all, not just have the result
  // hidden after the fact. See GAP.md FR-24.
  const currentUser = await getCurrentStaffUser();
  return <DashboardPage currentUserRole={currentUser?.role} />;
}
