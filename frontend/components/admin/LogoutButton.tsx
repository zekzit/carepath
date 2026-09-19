"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api/client";
import { LogOutIcon } from "@/components/icons";

export function LogoutButton() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await apiFetch("/accounts/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      aria-label={t("logout")}
      title={t("logout")}
      className="text-[#5b6e6b] disabled:opacity-50"
    >
      <LogOutIcon width={20} height={20} />
    </button>
  );
}
