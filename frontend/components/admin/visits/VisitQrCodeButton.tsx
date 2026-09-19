"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { PrinterIcon } from "@/components/icons";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/** Opens a small print-ready window with a QR code linking to the patient's
 * own /visit/[token] page (see app/visit/[token]/page.tsx) so staff can hand
 * a printed slip to the patient instead of reading the link aloud. */
export function VisitQrCodeButton({
  token,
  patientName,
  hn,
}: {
  token: string;
  patientName: string;
  hn: string;
}) {
  const t = useTranslations("admin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePrint() {
    setError(null);
    setBusy(true);
    try {
      const link = `${window.location.origin}/visit/${token}`;
      const qrDataUrl = await QRCode.toDataURL(link, { width: 260, margin: 1 });

      const printWindow = window.open("", "_blank", "width=420,height=560");
      if (!printWindow) {
        setError(t("printQrPopupBlocked"));
        return;
      }

      printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(t("printQrDocTitle"))}</title>
<style>
  body { font-family: system-ui, sans-serif; text-align: center; padding: 28px 20px; color: #1c2b28; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { font-size: 13px; color: #55625f; margin: 2px 0; }
  img { width: 240px; height: 240px; margin: 18px 0; }
  .link-label { margin-top: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #8a9c99; }
  .link { font-size: 12px; word-break: break-all; color: #1c2b28; }
</style>
</head>
<body>
  <h1>${escapeHtml(patientName)}</h1>
  <p>HN ${escapeHtml(hn)}</p>
  <img src="${qrDataUrl}" alt="QR" />
  <div class="link-label">${escapeHtml(t("printQrLinkLabel"))}</div>
  <div class="link">${escapeHtml(link)}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
      printWindow.document.close();
    } catch {
      setError(t("formGenericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handlePrint}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-app)] disabled:opacity-60"
      >
        <PrinterIcon width={14} height={14} />
        {t("printQrButton")}
      </button>
      {error && <div className="text-[11px] text-red-600">{error}</div>}
    </div>
  );
}
