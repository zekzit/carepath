import { useTranslations } from "next-intl";
import type { VisitView } from "@/lib/portal-data";
import { useLocale } from "next-intl";

type Scale = "default" | "kiosk";

export function QueueWidget({ queue, scale = "default" }: { queue: VisitView["queue"]; scale?: Scale }) {
  const t = useTranslations("patient");
  const locale = useLocale();
  const isKiosk = scale === "kiosk";
  const location = locale === "th" ? queue.locationTh : queue.locationEn;
  const progressPct = Math.max(8, 100 - queue.remaining * 8);

  return (
    <div className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] ${isKiosk ? "p-4" : "p-4"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] text-[#7c8f8c]">{t("queueTitleAt", { location })}</div>
          <div className={`font-bold text-[var(--ink)] ${isKiosk ? "text-[26px]" : "text-[24px]"}`}>{queue.ticketNumber}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-[#7c8f8c]">{t("queueCalling")}</div>
          <div className={`font-bold text-[var(--brand-teal)] ${isKiosk ? "text-[20px]" : "text-[18px]"}`}>{queue.currentNumber}</div>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#edf2f1]">
        <div className="h-full rounded-full bg-[var(--brand-teal)]" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="mt-2 text-[12.5px] text-[var(--ink-muted)]">
        {t("queueRemaining", { count: queue.remaining, minutes: queue.avgWaitMinutes })}
      </div>
    </div>
  );
}
