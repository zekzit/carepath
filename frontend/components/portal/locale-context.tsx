"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AppLocale } from "@/i18n/locales";
import th from "@/messages/th.json";
import en from "@/messages/en.json";

const MESSAGES: Record<AppLocale, typeof th> = { th, en };

type PortalLocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
};

const PortalLocaleContext = createContext<PortalLocaleContextValue | null>(null);

/**
 * Patient and Kiosk portals render in the *visit's* language
 * (Patient.preferred_language — MODELS.md § 3), independently of whatever
 * locale a staff member has picked in the Admin Portal. This provider scopes
 * next-intl to that language, seeded from `initialLocale`, with a local
 * toggle (components/portal/LanguageToggle.tsx) so the patient can override
 * it for this session without affecting their stored preference.
 */
export function PortalLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: ReactNode;
}) {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);

  return (
    <PortalLocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </PortalLocaleContext.Provider>
  );
}

export function usePortalLocale() {
  const ctx = useContext(PortalLocaleContext);
  if (!ctx) throw new Error("usePortalLocale must be used within a PortalLocaleProvider");
  return ctx;
}
