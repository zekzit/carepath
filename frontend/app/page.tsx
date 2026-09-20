"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Home() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const t = useTranslations("dev");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(() => setStatus("ok"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--surface-app)] p-6">
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-2xl font-bold text-[var(--ink)]">{t("title")}</h1>
        <p className="text-[var(--ink-muted)]">{t("subtitle")}</p>
      </div>

      <p className="text-sm text-[var(--ink-muted)]">
        {t("backendStatusLabel")}:{" "}
        {status === "loading" && <span>{t("backendStatusLoading")}</span>}
        {status === "ok" && <span className="text-green-600">{t("backendStatusOk")}</span>}
        {status === "error" && <span className="text-red-600">{t("backendStatusError")}</span>}
      </p>

      <div className="flex w-full max-w-xs flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{t("portalsTitle")}</div>
        <Link href="/admin" className="rounded-lg bg-[var(--brand-ink)] px-4 py-2.5 text-center text-sm font-semibold text-white">
          {t("openAdmin")}
        </Link>
        <Link
          href="/visit/demo-token"
          className="rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--ink)]"
        >
          {t("openPatient")}
        </Link>
        <Link
          href="/kiosk"
          className="rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--ink)]"
        >
          {t("openKiosk")}
        </Link>
        <p className="text-center text-[11px] text-[var(--ink-faint)]">{t("demoNote")}</p>
      </div>
    </div>
  );
}
