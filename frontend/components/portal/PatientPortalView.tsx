"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { PublicVisit } from "@/lib/api/public-visit";
import { fetchVisitByTokenClient, serviceStepLocationName } from "@/lib/api/public-visit";
import { CheckCircleIcon } from "@/components/icons";
import { PortalLocaleProvider } from "./locale-context";
import { PortalHeader } from "./PortalHeader";
import { StepTimeline } from "./StepTimeline";
import { NextStepCard } from "./NextStepCard";
import { QueueWidget } from "./QueueWidget";

// S6 (MODELS.md § 4): no push notifications in this MVP — the frontend polls
// the public by-token endpoint instead, since `ticket_number - current_number`
// already gives an exact "how many ahead of you" without one.
const POLL_INTERVAL_MS = 10_000;

export function PatientPortalView({ token, initialVisit }: { token: string; initialVisit: PublicVisit }) {
  return (
    <PortalLocaleProvider initialLocale={initialVisit.patient.preferred_language}>
      <PatientPortalBody token={token} initialVisit={initialVisit} />
    </PortalLocaleProvider>
  );
}

function PatientPortalBody({ token, initialVisit }: { token: string; initialVisit: PublicVisit }) {
  const t = useTranslations("patient");
  const locale = useLocale() as AppLocale;
  const [visit, setVisit] = useState(initialVisit);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchVisitByTokenClient(token).then((next) => {
        if (next) setVisit(next);
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--surface-app)]">
      <PortalHeader />

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-[18px]">
        <div>
          <div className="text-[13px] text-[var(--ink-muted)]">{t("greeting")}</div>
          <div className="text-[19px] font-bold">{visit.patient.full_name}</div>
          <div className="mt-0.5 text-[12px] text-[#7c8f8c]">
            {t("hnLabel")} {visit.patient.hn_code} · {t("appointmentLabel")} {visit.visit_date}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <div className="mb-3 text-[12.5px] font-bold">{t("stepsTitle")}</div>
          <StepTimeline steps={visit.steps} />
        </div>

        {visit.next_step ? (
          <>
            <NextStepCard nextStep={visit.next_step} />
            <QueueWidget ticket={visit.queue_ticket} locationName={serviceStepLocationName(visit.next_step, locale)} />
          </>
        ) : (
          <VisitCompleteCard />
        )}

        <div className="px-2 pb-1 pt-1.5 text-center text-[11px] text-[#9aaca8]">{t("footerNote")}</div>
      </div>
    </div>
  );
}

function VisitCompleteCard() {
  const t = useTranslations("patient");

  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-[var(--brand-ink)] p-5 text-center text-white">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-teal)]">
        <CheckCircleIcon width={26} height={26} stroke="#fff" strokeWidth={2.4} />
      </div>
      <div className="text-[15px] font-bold">{t("visitCompleteTitle")}</div>
      <div className="text-[12.5px] text-[#bfe0da]">{t("visitCompleteBody")}</div>
    </div>
  );
}
