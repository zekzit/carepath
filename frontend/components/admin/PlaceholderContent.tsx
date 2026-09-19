import { useTranslations } from "next-intl";
import { DashboardPlaceholderIcon } from "@/components/icons";

/** Standard placeholder body for admin pages whose content isn't built yet — only the nav/routes exist. */
export function PlaceholderContent() {
  const t = useTranslations("admin");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] py-24 text-[#8a9c99]">
      <DashboardPlaceholderIcon width={30} height={30} strokeWidth={1.6} className="text-[#b7cbc7]" />
      <div className="text-[14px] font-semibold">{t("placeholderTitle")}</div>
      <div className="text-[12.5px]">{t("placeholderDescription")}</div>
    </div>
  );
}
