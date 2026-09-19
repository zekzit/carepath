import { useTranslations } from "next-intl";
import { MapPinIcon } from "@/components/icons";
import { LanguageToggle } from "./LanguageToggle";

export function PortalHeader({ subtitle }: { subtitle?: string }) {
  const t = useTranslations("common");

  return (
    <div className="flex shrink-0 items-center justify-between bg-[var(--brand-ink)] px-[18px] py-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-ink-soft)]">
          <MapPinIcon width={15} height={15} stroke="#eaf3f1" strokeWidth={2} />
        </div>
        <div>
          <div className="text-[13.5px] font-bold text-[#eaf3f1]">{t("hospitalName")}</div>
          {subtitle && <div className="text-[10.5px] text-[#9fc4be]">{subtitle}</div>}
        </div>
      </div>
      <LanguageToggle variant="dark" />
    </div>
  );
}
