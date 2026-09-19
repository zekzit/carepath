"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/locales";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Sets the staff-facing locale (Admin Portal chrome only — see i18n/request.ts). */
export async function setLocale(locale: AppLocale) {
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
