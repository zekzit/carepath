import { getTranslations } from "next-intl/server";
import { PlaceholderContent } from "@/components/admin/PlaceholderContent";

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin");

  const stats = [
    { label: t("statPatientsToday"), value: "128" },
    { label: t("statWaiting"), value: "34" },
    { label: t("statAvgWait"), value: t("statAvgWaitValue") },
    { label: t("statOpenPoints"), value: "21 / 24" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-[18px]">
            <div className="text-[12px] text-[#7c8f8c]">{stat.label}</div>
            <div className="mt-1.5 text-[26px] font-bold text-[var(--ink)]">{stat.value}</div>
          </div>
        ))}
      </div>

      <PlaceholderContent />
    </div>
  );
}
