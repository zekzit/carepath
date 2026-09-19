"use client";

import { useTranslations } from "next-intl";
import { ExternalLinkIcon } from "@/components/icons";

/** Sibling to VisitQrCodeButton — opens the patient's own /visit/[token]
 * page in a new tab so staff can quickly verify the link (e.g. before
 * handing over the slip) or share it via chat/SMS without printing. */
export function VisitLinkButton({ token }: { token: string }) {
  const t = useTranslations("admin");
  // `href` is built with `window.location.origin` so it works on any host
  // (localhost in dev, the deployed domain in prod) — see
  // VisitQrCodeButton for the same pattern.
  const href = typeof window !== "undefined" ? `${window.location.origin}/visit/${token}` : `/visit/${token}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={t("openPatientLinkTitle")}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-app)]"
    >
      <ExternalLinkIcon width={14} height={14} />
      {t("openPatientLink")}
    </a>
  );
}