"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { KioskInfo } from "@/lib/api/facility";
import type { AppLocale } from "@/i18n/locales";
import type { PublicVisit } from "@/lib/api/public-visit";
import { fetchVisitByHnTodayClient, fetchVisitByTokenClient, serviceStepLocationName } from "@/lib/api/public-visit";
import { computeDirection } from "@/lib/direction";
import { CameraScanner, type CameraScannerMessages } from "./CameraScanner";
import { PortalLocaleProvider } from "./locale-context";
import { LanguageToggle } from "./LanguageToggle";
import { NextStepCard } from "./NextStepCard";
import { DirectionBlock } from "./DirectionBlock";
import { QueueWidget } from "./QueueWidget";
import { KeyboardIcon, MapPinIcon, RefreshIcon } from "@/components/icons";

type KioskScreen = "idle" | "manual" | "result";

export function KioskView({ kiosk, demoVisit }: { kiosk: KioskInfo; demoVisit: PublicVisit }) {
  // No patient is known yet on the idle screen, so this starts on the
  // hospital's default language. Once a real scan resolves a Visit, seed
  // this from Visit.patient.preferred_language instead.
  return (
    <PortalLocaleProvider initialLocale="th">
      <KioskBody kiosk={kiosk} demoVisit={demoVisit} />
    </PortalLocaleProvider>
  );
}

function KioskBody({ kiosk, demoVisit }: { kiosk: KioskInfo; demoVisit: PublicVisit }) {
  const [screen, setScreen] = useState<KioskScreen>("idle");
  const [activeVisit, setActiveVisit] = useState<PublicVisit | null>(null);

  function showResult(visit: PublicVisit) {
    setActiveVisit(visit);
    setScreen("result");
  }

  function reset() {
    setActiveVisit(null);
    setScreen("idle");
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#e7eeec] p-6">
      <div className="flex h-[900px] max-h-[92vh] w-[420px] flex-col overflow-hidden rounded-[28px] bg-[var(--brand-ink)] shadow-2xl">
        {screen === "idle" && (
          <IdleScreen
            kiosk={kiosk}
            onScan={() => showResult(demoVisit)}
            onScanResolved={showResult}
            onEnterManually={() => setScreen("manual")}
          />
        )}
        {screen === "manual" && <ManualEntryScreen onFound={showResult} onBack={() => setScreen("idle")} />}
        {screen === "result" && activeVisit && <ResultScreen kiosk={kiosk} visit={activeVisit} onReset={reset} />}
      </div>
    </div>
  );
}

function IdleScreen({
  kiosk,
  onScan,
  onScanResolved,
  onEnterManually,
}: {
  kiosk: KioskInfo;
  onScan: () => void;
  onScanResolved: (visit: PublicVisit) => void;
  onEnterManually: () => void;
}) {
  const t = useTranslations("kiosk");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-[22px] pb-2.5 pt-[22px]">
        <div className="flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[var(--brand-ink-soft)]">
            <MapPinIcon width={14} height={14} stroke="#eaf3f1" strokeWidth={2} />
          </div>
          <div className="text-[12.5px] font-bold text-[#eaf3f1]">{t("deviceLabel", { code: kiosk.device_code })}</div>
        </div>
        <LanguageToggle variant="dark" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
        <div className="text-center">
          <div className="text-[21px] font-bold leading-snug text-[#eaf3f1]">{t("idleTitleLine1")}</div>
          <div className="text-[21px] font-bold leading-snug text-[#eaf3f1]">{t("idleTitleLine2")}</div>
        </div>

        <CameraScanner<PublicVisit>
          resolveDecoded={fetchVisitByTokenClient}
          onResolved={onScanResolved}
          messages={kioskScannerMessages(t)}
        />

        <button type="button" onClick={onScan} className="rounded-full bg-[var(--brand-amber)] px-5 py-2.5 text-[13px] font-bold text-[var(--brand-amber-ink)]">
          {t("scanDemoCta")}
        </button>

        <button type="button" onClick={onEnterManually} className="flex items-center gap-2 text-[12.5px] text-[#7faaa3]">
          <KeyboardIcon width={16} height={16} stroke="#7faaa3" />
          {t("idleAltHint")}
        </button>
      </div>

      <div className="shrink-0 px-[22px] pb-[22px] pt-4 text-center text-[11px] text-[#6fa098]">{t("noLoginNote")}</div>
    </div>
  );
}

function kioskScannerMessages(t: ReturnType<typeof useTranslations<"kiosk">>): CameraScannerMessages {
  return {
    requesting: t("cameraRequesting"),
    scanningHint: t("cameraScanningHint"),
    unavailableTitle: t("cameraUnavailableTitle"),
    unavailableBody: t("cameraUnavailableBody"),
    resolving: t("cameraResolving"),
    notFound: t("cameraNotFound"),
  };
}

function ManualEntryScreen({ onFound, onBack }: { onFound: (visit: PublicVisit) => void; onBack: () => void }) {
  const t = useTranslations("kiosk");
  const [hnCode, setHnCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = hnCode.trim();
    if (!trimmed) return;

    setSearching(true);
    setError(null);
    const visit = await fetchVisitByHnTodayClient(trimmed);
    setSearching(false);

    if (visit) {
      onFound(visit);
    } else {
      setError(t("manualEntryNotFound"));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-[22px] pb-2.5 pt-[22px]">
        <button type="button" onClick={onBack} className="text-[12.5px] font-semibold text-[#bfe0da]">
          ← {t("manualEntryBack")}
        </button>
        <LanguageToggle variant="dark" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.08]">
          <KeyboardIcon width={26} height={26} stroke="#bfe0da" strokeWidth={1.6} />
        </div>
        <div className="text-center text-[19px] font-bold text-[#eaf3f1]">{t("manualEntryTitle")}</div>

        <input
          type="text"
          inputMode="text"
          autoFocus
          value={hnCode}
          onChange={(event) => setHnCode(event.target.value)}
          placeholder={t("manualEntryPlaceholder")}
          className="w-full max-w-[280px] rounded-2xl border-2 border-white/10 bg-white/[0.06] px-5 py-4 text-center text-[20px] font-semibold tracking-wide text-white outline-none placeholder:text-[#7faaa3] focus:border-[var(--brand-amber)]"
        />

        {error && <div className="max-w-[280px] text-center text-[13px] text-[#f3b8a8]">{error}</div>}

        <button
          type="submit"
          disabled={searching || hnCode.trim().length === 0}
          className="w-full max-w-[280px] rounded-2xl bg-[var(--brand-amber)] px-5 py-4 text-[16px] font-bold text-[var(--brand-amber-ink)] disabled:opacity-50"
        >
          {searching ? t("manualEntrySearching") : t("manualEntrySubmit")}
        </button>
      </form>
    </div>
  );
}

function ResultScreen({ kiosk, visit, onReset }: { kiosk: KioskInfo; visit: PublicVisit; onReset: () => void }) {
  const tPatient = useTranslations("patient");
  const tKiosk = useTranslations("kiosk");
  const locale = useLocale() as AppLocale;

  // Phase 7: straight-line bearing from this kiosk node to the patient's
  // next service point. `computeDirection` returns null-equivalent fields
  // (distance_m=null, etc.) when something's off, so DirectionBlock can
  // always render something meaningful — including a "different floor"
  // banner when the destination lives on another floor plan image.
  const direction = visit.next_step ? computeDirection(kiosk, visit.next_step.service_point) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 bg-[var(--brand-ink)] px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-[#9fc4be]">{tPatient("greeting")}</div>
          <LanguageToggle variant="dark" />
        </div>
        <div className="text-[19px] font-bold text-white">{visit.patient.full_name}</div>
        <div className="mt-0.5 text-[11.5px] text-[#7faaa3]">
          {tPatient("hnLabel")} {visit.patient.hn_code}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 overflow-auto bg-[var(--surface-app)] p-[18px]">
        {visit.next_step && direction && (
          <DirectionBlock direction={direction} destination={visit.next_step.service_point} locale={locale} scale="kiosk" />
        )}
        {visit.next_step && (
          <>
            <NextStepCard nextStep={visit.next_step} scale="kiosk" />
            <QueueWidget ticket={visit.queue_ticket} locationName={serviceStepLocationName(visit.next_step, locale)} scale="kiosk" />
          </>
        )}

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
