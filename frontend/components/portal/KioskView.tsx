"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { KioskDevice, VisitView } from "@/lib/portal-data";
import { PortalLocaleProvider } from "./locale-context";
import { LanguageToggle } from "./LanguageToggle";
import { NextStepCard } from "./NextStepCard";
import { QueueWidget } from "./QueueWidget";
import { KeyboardIcon, MapPinIcon, QrScanIcon, RefreshIcon } from "@/components/icons";

type KioskScreen = "idle" | "result";

export function KioskView({ kiosk, demoVisit }: { kiosk: KioskDevice; demoVisit: VisitView }) {
  // No patient is known yet on the idle screen, so this starts on the
  // hospital's default language. Once a real scan resolves a Visit, seed
  // this from Visit.patient.preferred_language instead.
  return (
    <PortalLocaleProvider initialLocale="th">
      <KioskBody kiosk={kiosk} demoVisit={demoVisit} />
    </PortalLocaleProvider>
  );
}

function KioskBody({ kiosk, demoVisit }: { kiosk: KioskDevice; demoVisit: VisitView }) {
  const [screen, setScreen] = useState<KioskScreen>("idle");

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#e7eeec] p-6">
      <div className="flex h-[900px] max-h-[92vh] w-[420px] flex-col overflow-hidden rounded-[28px] bg-[var(--brand-ink)] shadow-2xl">
        {screen === "idle" ? (
          <IdleScreen kiosk={kiosk} onScan={() => setScreen("result")} />
        ) : (
          <ResultScreen visit={demoVisit} onReset={() => setScreen("idle")} />
        )}
      </div>
    </div>
  );
}

function IdleScreen({ kiosk, onScan }: { kiosk: KioskDevice; onScan: () => void }) {
  const t = useTranslations("kiosk");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-[22px] pb-2.5 pt-[22px]">
        <div className="flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[var(--brand-ink-soft)]">
            <MapPinIcon width={14} height={14} stroke="#eaf3f1" strokeWidth={2} />
          </div>
          <div className="text-[12.5px] font-bold text-[#eaf3f1]">{t("deviceLabel", { code: kiosk.deviceCode })}</div>
        </div>
        <LanguageToggle variant="dark" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
        <div className="text-center">
          <div className="text-[21px] font-bold leading-snug text-[#eaf3f1]">{t("idleTitleLine1")}</div>
          <div className="text-[21px] font-bold leading-snug text-[#eaf3f1]">{t("idleTitleLine2")}</div>
        </div>

        <button
          type="button"
          onClick={onScan}
          className="relative flex h-[220px] w-[220px] items-center justify-center rounded-3xl bg-white/[0.06]"
        >
          {(["top-4 left-4 border-t-4 border-l-4 rounded-tl-md", "top-4 right-4 border-t-4 border-r-4 rounded-tr-md", "bottom-4 left-4 border-b-4 border-l-4 rounded-bl-md", "bottom-4 right-4 border-b-4 border-r-4 rounded-br-md"] as const).map(
            (cls) => (
              <span key={cls} className={`absolute h-7 w-7 border-[var(--brand-amber)] ${cls}`} />
            ),
          )}
          <QrScanIcon width={72} height={72} stroke="#bfe0da" strokeWidth={1.5} />
        </button>

        <button type="button" onClick={onScan} className="rounded-full bg-[var(--brand-amber)] px-5 py-2.5 text-[13px] font-bold text-[var(--brand-amber-ink)]">
          {t("scanDemoCta")}
        </button>

        <div className="flex items-center gap-2 text-[12.5px] text-[#7faaa3]">
          <KeyboardIcon width={16} height={16} stroke="#7faaa3" />
          {t("idleAltHint")}
        </div>
      </div>

      <div className="shrink-0 px-[22px] pb-[22px] pt-4 text-center text-[11px] text-[#6fa098]">{t("noLoginNote")}</div>
    </div>
  );
}

function ResultScreen({ visit, onReset }: { visit: VisitView; onReset: () => void }) {
  const tPatient = useTranslations("patient");
  const tKiosk = useTranslations("kiosk");

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 bg-[var(--brand-ink)] px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-[#9fc4be]">{tPatient("greeting")}</div>
          <LanguageToggle variant="dark" />
        </div>
        <div className="text-[19px] font-bold text-white">{visit.patientName}</div>
        <div className="mt-0.5 text-[11.5px] text-[#7faaa3]">
          {tPatient("hnLabel")} {visit.hnCode}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 overflow-auto bg-[var(--surface-app)] p-[18px]">
        <NextStepCard nextStep={visit.nextStep} scale="kiosk" />
        <QueueWidget queue={visit.queue} scale="kiosk" />

        <div className="flex-1" />

        <button
          type="button"
          onClick={onReset}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--border-dashed)] bg-[var(--surface-card)] px-3.5 py-3.5 text-[14.5px] font-semibold text-[var(--ink-muted)]"
        >
          <RefreshIcon width={17} height={17} stroke="var(--ink-muted)" />
          {tKiosk("resetCta")}
        </button>
      </div>
    </div>
  );
}
