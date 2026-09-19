"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { CameraOffIcon, QrScanIcon } from "@/components/icons";
import { extractQrToken } from "@/lib/qr-token";

// Phase 8: shared camera QR scanner, used by both the Kiosk Portal
// (decodes a Visit's qr_token) and the Patient Portal (decodes a
// location_qr_code on a junction/vertical-connector/entrance sticker).
//
// Pure UI primitive — owns the `getUserMedia` lifecycle, the decode
// animation frame loop, the permission/unsupported fallback, and the
// auto-retry on "decoded but unresolved" (unknown qr, lookup failed).
// Knows nothing about Visits or Nodes: callers pass `resolveDecoded`
// which receives the raw QR payload (after `extractQrToken` cleanup)
// and returns the resolved value or `null` to trigger a retry.
//
// Messages are passed in by the caller so the same component can show
// page-specific copy in the fallback line ("use manual HN entry below"
// vs "use manual location code entry below").

export type CameraScannerMessages = {
  requesting: string;
  scanningHint: string;
  unavailableTitle: string;
  unavailableBody: string;
  resolving: string;
  notFound: string;
};

type CameraScannerProps<T> = {
  resolveDecoded: (decoded: string) => Promise<T | null>;
  onResolved: (result: T) => void;
  messages: CameraScannerMessages;
};

type CameraPhase = "idle" | "requesting" | "streaming" | "resolving" | "not-found" | "unavailable";

const NOT_FOUND_RETRY_DELAY_MS = 2500;

export function CameraScanner<T>({ resolveDecoded, onResolved, messages }: CameraScannerProps<T>) {
  const [phase, setPhase] = useState<CameraPhase>("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  // Keep the latest callbacks without re-running the mount effect below every
  // time the parent re-renders (callers pass them inline, unmemoized).
  const resolveDecodedRef = useRef(resolveDecoded);
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    resolveDecodedRef.current = resolveDecoded;
    onResolvedRef.current = onResolved;
  }, [resolveDecoded, onResolved]);

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

      const result = await resolveDecodedRef.current(token);
      if (unmountedRef.current) return;

      if (result) {
        onResolvedRef.current(result);
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
            <span className="text-[13px] font-semibold text-white">{messages.resolving}</span>
          </div>
        )}
        {phase === "not-found" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 px-4 text-center">
            <span className="text-[12.5px] font-semibold text-[#f3b8a8]">{messages.notFound}</span>
          </div>
        )}
      </div>

      <div className="min-h-[32px] max-w-[260px] text-center text-[12px] text-[#9fc4be]">
        {phase === "requesting" && messages.requesting}
        {phase === "streaming" && messages.scanningHint}
        {phase === "unavailable" && (
          <>
            <div className="font-semibold text-[#f3b8a8]">{messages.unavailableTitle}</div>
            <div>{messages.unavailableBody}</div>
          </>
        )}
      </div>
    </div>
  );
}