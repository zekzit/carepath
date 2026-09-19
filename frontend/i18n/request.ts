import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isAppLocale } from "./locales";

// This drives the *staff-facing* locale only (Admin Portal chrome), selected
// via the NEXT_LOCALE cookie (see lib/locale-actions.ts).
//
// The Patient and Kiosk portals do NOT use this — they render in the
// visit's own language (Visit.patient.preferred_language) via a locally
// scoped <NextIntlClientProvider> in components/portal/locale-context.tsx,
// so one staff member's language choice never affects what a patient sees.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
