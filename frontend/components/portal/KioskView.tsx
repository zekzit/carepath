"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import jsQR from "jsqr";
import { useLocale, useTranslations } from "next-intl";
import type { KioskDevice } from "@/lib/portal-data";
import type { AppLocale } from "@/i18n/locales";
import type { PublicVisit } from "@/lib/api/public-visit";
import { fetchVisitByHnTodayClient, fetchVisitByTokenClient, serviceStepLocationName } from "@/lib/api/public-visit";
import { extractQrToken } from "@/lib/qr-token";
import { PortalLocaleProvider } from "./locale-context";
import { LanguageToggle } from "./LanguageToggle";
import { NextStepCard } from "./NextStepCard";
import { QueueWidget } from "./QueueWidget";
import { CameraOffIcon, KeyboardIcon, MapPinIcon, QrScanIcon, RefreshIcon } from "@/components/icons";

type KioskScreen = "idle" | "manual" | "result";

export function KioskView({ kiosk, demoVisit }: { kiosk: KioskDevice; demoVisit: PublicVisit }) {
  // No patient is known yet on the idle screen, so this starts on the
  // hospital's default language. Once a real scan resolves a Visit, seed
  // this from Visit.patient.preferred_language instead.
  return (
    <PortalLocaleProvider initialLocale="th">
      <KioskBody kiosk={kiosk} demoVisit={demoVisit} />
    </PortalLocaleProvider>
  );
}

function KioskBody({ kiosk, demoVisit }: { kiosk: KioskDevice; demoVisit: PublicVisit }) {
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
        {screen === "result" && activeVisit && <ResultScreen visit={activeVisit} onReset={reset} />}
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
  kiosk: KioskDevice;
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
          <div className="text-[12.5px] font-bold text-[#eaf3f1]">{t("deviceLabel", { code: kiosk.deviceCode })}</div>
        </div>
        <LanguageToggle variant="dark" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-5">
        <div className="text-center">
          <div className="text-[21px] font-bold leading-snug text-[#eaf3f1]">{t("idleTitleLine1")}</div>
          <div className="text-[21px] font-bold leading-snug text-[#eaf3f1]">{t("idleTitleLine2")}</div>
        </div>

        <CameraScanner onResolved={onScanResolved} />

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

// --- Camera QR scanning (Phase 6) -------------------------------------------------
//
// Lives entirely inside IdleScreen: mounted only while `screen === "idle"`, so
// simply unmounting (tapping "manual entry", a successful scan handing off to
// the result screen, or the demo button) is what releases the camera — the
// effect cleanup below always runs. `getUserMedia` support is checked before
// ever prompting, so an unsupported browser goes straight to the "unavailable"
// fallback instead of a doomed permission prompt. Permission-denied and
// no-camera-device both collapse into that same fallback message, since the
// remedy (use the manual HN button, which stays visible/reachable the whole
// time) is identical either way.

type CameraPhase = "idle" | "requesting" | "streaming" | "resolving" | "not-found" | "unavailable";

const NOT_FOUND_RETRY_DELAY_MS = 2500;

function CameraScanner({ onResolved }: { onResolved: (visit: PublicVisit) => void }) {
  const t = useTranslations("kiosk");
  const [phase, setPhase] = useState<CameraPhase>("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  // Keep the latest callback without re-running the mount effect below every
  // time the parent re-renders (KioskBody defines it inline, unmemoized).
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    unmountedRef.current = false;

    function stopStream() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }

    function scheduleRetry() {
      setPhase("not-found");
      retryTimeoutRef.current = window.setTimeout(() => {
        if (unmountedRef.current) return;
        void start();
      }, NOT_FOUND_RETRY_DELAY_MS);
    }

    async function handleDecoded(decoded: string) {
      // Stop scanning the instant a code is found — don't leave the camera
      // running while the lookup resolves.
      stopStream();
      setPhase("resolving");

      const token = extractQrToken(decoded);
      if (!token) {
        scheduleRetry();
        return;
      }

      const visit = await fetchVisitByTokenClient(token);
      if (unmountedRef.current) return;

      if (visit) {
        onResolvedRef.current(visit);
      } else {
        scheduleRetry();
      }
    }

    function tick() {
      const video = videoRef.current;
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);

      if (code && code.data) {
        void handleDecoded(code.data);
        return; // handleDecoded owns what happens next — don't keep looping
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      const hasCameraSupport =
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window !== "undefined" &&
        window.isSecureContext;

      if (!hasCameraSupport) {
        setPhase("unavailable");
        return;
      }

      setPhase("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (unmountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            // Autoplay can reject on some browsers even when muted+playsInline;
            // the decode loop below just waits for readyState regardless.
          });
        }

        setPhase("streaming");
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // Covers NotAllowedError (permission denied), NotFoundError (no
        // camera device), and anything else getUserMedia can throw — all
        // funnel to the same "use manual entry instead" fallback.
        if (!unmountedRef.current) setPhase("unavailable");
      }
    }

    void start();

    return () => {
      unmountedRef.current = true;
      stopStream();
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  const showVideo = phase === "streaming" || phase === "resolving" || phase === "not-found";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-[220px] w-[220px] items-center justify-center overflow-hidden rounded-3xl bg-white/[0.06]">
        {(
          [
            "top-4 left-4 border-t-4 border-l-4 rounded-tl-md",
            "top-4 right-4 border-t-4 border-r-4 rounded-tr-md",
            "bottom-4 left-4 border-b-4 border-l-4 rounded-bl-md",
            "bottom-4 right-4 border-b-4 border-r-4 rounded-br-md",
          ] as const
        ).map((cls) => (
          <span key={cls} className={`pointer-events-none absolute z-10 h-7 w-7 border-[var(--brand-amber)] ${cls}`} />
        ))}

        {/* The <video> element stays mounted whenever the stream might be live so
            the ref is attached before getUserMedia resolves; it's just visually
            hidden until a frame is actually flowing. */}
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className={`h-full w-full rounded-3xl object-cover ${showVideo ? "" : "hidden"}`}
        />

        {!showVideo && phase !== "unavailable" && <QrScanIcon width={72} height={72} stroke="#bfe0da" strokeWidth={1.5} />}
        {phase === "unavailable" && <CameraOffIcon width={60} height={60} stroke="#bfe0da" strokeWidth={1.5} />}

        {phase === "resolving" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45">
            <span className="text-[13px] font-semibold text-white">{t("cameraResolving")}</span>
          </div>
        )}
        {phase === "not-found" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4 text-center">
            <span className="text-[12.5px] font-semibold text-[#f3b8a8]">{t("cameraNotFound")}</span>
          </div>
        )}
      </div>

      <div className="min-h-[32px] max-w-[260px] text-center text-[12px] text-[#9fc4be]">
        {phase === "requesting" && t("cameraRequesting")}
        {phase === "streaming" && t("cameraScanningHint")}
        {phase === "unavailable" && (
          <>
            <div className="font-semibold text-[#f3b8a8]">{t("cameraUnavailableTitle")}</div>
            <div>{t("cameraUnavailableBody")}</div>
          </>
        )}
      </div>
    </div>
  );
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

function ResultScreen({ visit, onReset }: { visit: PublicVisit; onReset: () => void }) {
  const tPatient = useTranslations("patient");
  const tKiosk = useTranslations("kiosk");
  const locale = useLocale() as AppLocale;

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
