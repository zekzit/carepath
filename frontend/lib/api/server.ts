import { cookies } from "next/headers";
import type { StaffRole } from "@/lib/roles";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export type CurrentStaffUser = {
  id: number;
  username: string;
  full_name: string;
  role: StaffRole;
};

/**
 * Server-only: reads the signed-in StaffUser straight from Django,
 * forwarding the incoming request's cookies (a plain server-to-server GET,
 * so there's no Set-Cookie-forwarding problem to solve). Used to gate
 * `/admin/*` in app/admin/(authenticated)/layout.tsx.
 *
 * Login/logout themselves stay client-side (see lib/api/client.ts) so the
 * browser's own cookie jar picks up the session + rotated CSRF cookies
 * without us having to relay Set-Cookie headers by hand.
 */
export async function getCurrentStaffUser(): Promise<CurrentStaffUser | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${BACKEND_URL}/api/accounts/me`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}
