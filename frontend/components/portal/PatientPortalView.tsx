"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import type { LocationNodeInfo } from "@/lib/api/facility";
import { fetchLocationNodeByQrClient } from "@/lib/api/facility";
import type { PublicVisit } from "@/lib/api/public-visit";
import { fetchVisitByTokenClient } from "@/lib/api/public-visit";
import { CheckCircleIcon, KeyboardIcon, MapPinIcon, QrScanIcon, RefreshIcon, XIcon } from "@/components/icons";
import { CameraScanner, type CameraScannerMessages } from "./CameraScanner";
import { PortalLocaleProvider } from "./locale-context";
import { PortalHeader } from "./PortalHeader";
import { StepTimeline } from "./StepTimeline";
import { NextStepOptionsList } from "./NextStepOptionsList";

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
  const [visit, setVisit] = useState(initialVisit);

  // Phase 8: "where am I" state. In-memory only (per IMPLEMENT_PLAN
  // decision: no persistence — every fresh page load starts un-scanned,
  // because the patient's physical position may have changed since last
  // visit and we don't want stale bearings). The scanner modal flips
  // `scannerOpen`; a successful scan lands in `currentLocation` and the
  // modal closes itself.
  const [currentLocation, setCurrentLocation] = useState<LocationNodeInfo | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

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

        <CurrentLocationCard
          currentLocation={currentLocation}
          onScan={() => setScannerOpen(true)}
          onRescan={() => setScannerOpen(true)}
          onClear={() => setCurrentLocation(null)}
        />

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4">
          <div className="mb-3 text-[12.5px] font-bold">{t("stepsTitle")}</div>
          <StepTimeline steps={visit.steps} />
        </div>

        {visit.next_steps.length > 0 ? (
          <NextStepOptionsList options={visit.next_steps} origin={currentLocation} variant="patient" />
        ) : (
          <VisitCompleteCard />
        )}

        <div className="px-2 pb-1 pt-1.5 text-center text-[11px] text-[#9aaca8]">{t("footerNote")}</div>
      </div>

      {scannerOpen && (
        <LocationScannerModal
          onClose={() => setScannerOpen(false)}
          onResolved={(loc) => {
            setCurrentLocation(loc);
            setScannerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CurrentLocationCard({
  currentLocation,
  onScan,
  onRescan,
  onClear,
}: {
  currentLocation: LocationNodeInfo | null;
  onScan: () => void;
  onRescan: () => void;
  onClear: () => void;
}) {
  const t = useTranslations("patient");
  const locale = useLocale() as AppLocale;

  if (!currentLocation) {
    return (
      <button
        type="button"
        onClick={onScan}
        className="flex items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-[var(--brand-teal)] bg-[var(--surface-card)] px-4 py-3.5 text-[13.5px] font-semibold text-[var(--brand-teal)]"
      >
        <QrScanIcon width={18} height={18} stroke="var(--brand-teal)" strokeWidth={1.8} />
        {t("scanLocationCta")}
      </button>
    );
  }

  const floorName = locale === "th" ? currentLocation.floor_name_th : currentLocation.floor_name_en;
  const nodeName = locale === "th" ? currentLocation.name_th : currentLocation.name_en;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-[var(--brand-teal)] text-white">
            <MapPinIcon width={18} height={18} stroke="#fff" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="text-[11.5px] font-medium text-[var(--ink-muted)]">{t("currentLocationLabel")}</div>
            <div className="text-[14px] font-bold text-[var(--ink)]">{nodeName}</div>
            <div className="text-[11.5px] text-[#7c8f8c]">{floorName}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRescan}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-app)]"
          aria-label={t("changeLocationCta")}
          title={t("changeLocationCta")}
        >
          <RefreshIcon width={15} height={15} stroke="var(--ink-muted)" />
        </button>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="self-end text-[11.5px] font-medium text-[var(--ink-faint)] hover:underline"
      >
        {t("clearLocationCta")}
      </button>
    </div>
  );
}

function LocationScannerModal({
  onClose,
  onResolved,
}: {
  onClose: () => void;
  onResolved: (location: LocationNodeInfo) => void;
}) {
  const t = useTranslations("patient");
  const [manualCode, setManualCode] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSearching, setManualSearching] = useState(false);

  const messages: CameraScannerMessages = {
    requesting: t("cameraRequesting"),
    scanningHint: t("cameraScanningHint"),
    unavailableTitle: t("cameraUnavailableTitle"),
    unavailableBody: t("cameraUnavailableBody"),
    resolving: t("cameraResolving"),
    notFound: t("cameraNotFound"),
  };

  async function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    setManualSearching(true);
    setManualError(null);
    const loc = await fetchLocationNodeByQrClient(trimmed);
    setManualSearching(false);
    if (loc) {
      onResolved(loc);
    } else {
      setManualError(t("locationNotFound"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[28px] bg-[var(--brand-ink)] text-white shadow-2xl sm:rounded-[28px]">
        <div className="flex shrink-0 items-center justify-between px-[22px] pb-2.5 pt-[22px]">
          <div className="text-[15px] font-bold">{t("scanLocationTitle")}</div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-[#bfe0da]"
            aria-label={t("closeScannerCta")}
          >
            <XIcon width={16} height={16} stroke="#bfe0da" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center gap-5 overflow-auto px-5 pb-6 pt-2">
          <div className="text-center text-[12px] text-[#9fc4be]">{t("scanLocationHint")}</div>

          <CameraScanner<LocationNodeInfo>
            resolveDecoded={fetchLocationNodeByQrClient}
            onResolved={onResolved}
            messages={messages}
          />

          <div className="flex w-full items-center gap-3 text-[11px] text-[#6fa098]">
            <span className="h-px flex-1 bg-white/10" />
            <span className="shrink-0">{t("manualEntryDivider")}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleManualSubmit} className="flex w-full flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08]">
              <KeyboardIcon width={22} height={22} stroke="#bfe0da" strokeWidth={1.6} />
            </div>
            <input
              type="text"
              inputMode="text"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder={t("manualLocationPlaceholder")}
              className="w-full max-w-[300px] rounded-2xl border-2 border-white/10 bg-white/[0.06] px-5 py-3.5 text-center text-[15px] font-semibold tracking-wide text-white outline-none placeholder:text-[#7faaa3] focus:border-[var(--brand-amber)]"
            />
            {manualError && <div className="max-w-[300px] text-center text-[12.5px] text-[#f3b8a8]">{manualError}</div>}
            <button
              type="submit"
              disabled={manualSearching || manualCode.trim().length === 0}
              className="w-full max-w-[300px] rounded-2xl bg-[var(--brand-amber)] px-5 py-3.5 text-[14.5px] font-bold text-[var(--brand-amber-ink)] disabled:opacity-50"
            >
              {manualSearching ? t("manualEntrySearching") : t("manualEntrySubmit")}
            </button>
          </form>
        </div>
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