import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentStaffUser } from "@/lib/api/server";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";

export const metadata: Metadata = {
  title: "Admin Portal",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentStaffUser();
  if (!currentUser) redirect("/admin/login");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface-app)] text-[var(--ink)]">
      <Sidebar currentUser={currentUser} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex flex-1 flex-col overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
