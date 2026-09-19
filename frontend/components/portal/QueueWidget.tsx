import { useTranslations } from "next-intl";
import type { PublicVisitQueueTicket } from "@/lib/api/public-visit";

type Scale = "default" | "kiosk";

export function QueueWidget({
  ticket,
  locationName,
  scale = "default",
}: {
  ticket: PublicVisitQueueTicket | null;
  locationName: string;
  scale?: Scale;
}) {
  const t = useTranslations("patient");
  const isKiosk = scale === "kiosk";

  // State 2 (IMPLEMENT_PLAN.md Phase 3): the step is eligible to start but no
  // staff member has started it at the Admin Portal yet, so `queue_ticket` is
  // null — there is no queue number to show yet, not an empty/broken widget.
  if (!ticket) {
    return (
      <div
        className={`rounded-2xl border border-dashed border-[var(--border-dashed)] bg-[var(--surface-card)] text-center text-[var(--ink-muted)] ${
          isKiosk ? "p-4 text-[13.5px]" : "p-4 text-[12.5px]"
        }`}
      >
        {t("noQueueYet")}
      </div>
    );
  }

  const remaining = Math.max(ticket.ticket_number - ticket.current_number, 0);
  const progressPct = Math.max(8, 100 - remaining * 8);

  return (
    <div className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] ${isKiosk ? "p-4" : "p-4"}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12px] text-[#7c8f8c]">{t("queueTitleAt", { location: locationName })}</div>
          <div className={`font-bold text-[var(--ink)] ${isKiosk ? "text-[26px]" : "text-[24px]"}`}>{ticket.ticket_number}</div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-[#7c8f8c]">{t("queueCalling")}</div>
          <div className={`font-bold text-[var(--brand-teal)] ${isKiosk ? "text-[20px]" : "text-[18px]"}`}>{ticket.current_number}</div>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#edf2f1]">
        <div className="h-full rounded-full bg-[var(--brand-teal)]" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="mt-2 text-[12.5px] text-[var(--ink-muted)]">{t("queueRemaining", { count: remaining })}</div>
    </div>
  );
}
