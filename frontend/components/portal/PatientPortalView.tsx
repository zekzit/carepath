"use client";

import { useTranslations } from "next-intl";
import type { VisitView } from "@/lib/portal-data";
import { PortalLocaleProvider } from "./locale-context";
import { PortalHeader } from "./PortalHeader";
import { StepTimeline } from "./StepTimeline";
import { NextStepCard } from "./NextStepCard";
import { QueueWidget } from "./QueueWidget";

export function PatientPortalView({ visit }: { visit: VisitView }) {
  return (
    <PortalLocaleProvider initialLocale={visit.preferredLanguage}>
      <PatientPortalBody visit={visit} />
    </PortalLocaleProvider>
  );
}

function PatientPortalBody({ visit }: { visit: VisitView }) {
  const t = useTranslations("patient");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[var(--surface-app)]">
      <PortalHeader />

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-[18px]">
        <div>
          <div className="text-[13px] text-[var(--ink-muted)]">{t("greeting")}</div>
          <div className="text-[19px] font-bold">{visit.patientName}</div>
          <div className="mt-0.5 text-[12px] text-[#7c8f8c]">
            {t("hnLabel")} {visit.hnCode} · {t("appointmentLabel")} {visit.appointmentDateLabel}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <div className="mb-3 text-[12.5px] font-bold">{t("stepsTitle")}</div>
          <StepTimeline steps={visit.steps} />
        </div>

        <NextStepCard nextStep={visit.nextStep} />
        <QueueWidget queue={visit.queue} />

        <div className="px-2 pb-1 pt-1.5 text-center text-[11px] text-[#9aaca8]">{t("footerNote")}</div>
      </div>
    </div>
  );
}
