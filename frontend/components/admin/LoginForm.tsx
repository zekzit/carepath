"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api/client";
import { MapPinIcon } from "@/components/icons";

export function LoginForm() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch("/accounts/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("loginError"));
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-8"
    >
      <div className="flex flex-col items-center gap-2 pb-1 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-ink)]">
          <MapPinIcon width={22} height={22} stroke="#eaf3f1" strokeWidth={2} />
        </div>
        <div className="text-lg font-bold text-[var(--ink)]">{t("loginTitle")}</div>
        <div className="text-sm text-[var(--ink-muted)]">{t("loginSubtitle")}</div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-[var(--ink)]">
        {t("loginUsername")}
        <input
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          autoFocus
          className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-teal)]"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-[var(--ink)]">
        {t("loginPassword")}
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-teal)]"
        />
      </label>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 rounded-lg bg-[var(--brand-ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting ? t("loginSubmitting") : t("loginSubmit")}
      </button>
    </form>
  );
}
