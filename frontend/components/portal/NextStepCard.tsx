import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { PublicVisitStep } from "@/lib/api/public-visit";
import { serviceStepLocationName } from "@/lib/api/public-visit";
import { MapPinIcon, NavigateIcon } from "@/components/icons";

type Scale = "default" | "kiosk";

// No walk-time estimate here — there is no routing engine/distance data
// behind this endpoint (see lib/api/public-visit.ts), so this only shows
// where to go, not how long it takes.
export function NextStepCard({ nextStep, scale = "default" }: { nextStep: PublicVisitStep; scale?: Scale }) {
  const t = useTranslations("patient");
  const locale = useLocale() as AppLocale;
  const isKiosk = scale === "kiosk";
  const location = serviceStepLocationName(nextStep, locale);

  return (
    <div className={`flex flex-col gap-2.5 rounded-2xl bg-[var(--brand-ink)] text-white ${isKiosk ? "p-[18px]" : "p-4"}`}>
      <div className={`${isKiosk ? "text-[12px]" : "text-[12px]"} text-[#9fc4be]`}>{t("nextStepTitle")}</div>
      <div className="flex items-center gap-2.5">
        <div className={`flex shrink-0 items-center justify-center rounded-[10px] bg-white/10 ${isKiosk ? "h-[42px] w-[42px]" : "h-10 w-10"}`}>
          <MapPinIcon width={isKiosk ? 22 : 20} height={isKiosk ? 22 : 20} stroke="#fff" />
        </div>
        <div className={`${isKiosk ? "text-[16px]" : "text-[15px]"} font-bold`}>{location}</div>
      </div>
      <button
        type="button"
        className={`mt-0.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-amber)] font-bold text-[var(--brand-amber-ink)] ${
          isKiosk ? "px-4 py-4 text-[16px]" : "px-3 py-3 text-[14.5px]"
        }`}
      >
        <NavigateIcon width={isKiosk ? 18 : 16} height={isKiosk ? 18 : 16} stroke="var(--brand-amber-ink)" strokeWidth={2.2} />
        {t("navigateCta")}
      </button>
    </div>
  );
}
