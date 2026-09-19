import { redirect } from "next/navigation";
import { getCurrentStaffUser } from "@/lib/api/server";
import { LoginForm } from "@/components/admin/LoginForm";

// Deliberately outside app/admin/(authenticated)/ — that route group's
// layout gates on being logged in, which would otherwise redirect this
// page right back to itself.
export default async function AdminLoginPage() {
  const currentUser = await getCurrentStaffUser();
  if (currentUser) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface-app)] p-6">
      <LoginForm />
    </div>
  );
}
