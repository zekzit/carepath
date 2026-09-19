import type { AppLocale } from "@/i18n/locales";

// Public, no-auth Patient/Kiosk Portal data — GET /api/visits/by-token/{qr_token}
// (backend/visits/views.py::visit_by_token + serialize_public_visit). Identity
// here is the qr_token itself (see MODELS.md § 3, Visit.qr_token) — never
// look this up by Visit.id.
//
// There is intentionally no walk-time/avg-wait-minutes field anywhere below:
// the backend has no routing engine and no historical-wait-time tracking
// (see IMPLEMENT_PLAN.md Phase 3), so the old mock's `walkTimeMinutes` /
// `avgWaitMinutes` are dropped rather than estimated client-side.

export type PublicVisitStepStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "SKIPPED";

export type PublicVisitServicePoint = {
  id: number;
  name_th: string;
  name_en: string;
  department_th: string; // may be "" — prefer over name_* when non-empty
  department_en: string;
  // Phase 7 (Kiosk compass guidance): the node's floor-plan coordinates +
  // the floor's calibrated scale. Combined with the kiosk node's own
  // position (from GET /api/facility/kiosks/{device_code}), the frontend
  // computes straight-line bearing + distance to guide the patient.
  pos_x: number;
  pos_y: number;
  floor_id: number;
  floor_scale_m_per_px: number | null;
  floor_name_th: string;
  floor_name_en: string;
};

export type PublicVisitStep = {
  id: number;
  sequence_order: number;
  status: PublicVisitStepStatus;
  prerequisite_steps: number[];
  started_at: string | null;
  completed_at: string | null;
  service_point: PublicVisitServicePoint;
};

export type PublicVisitQueueTicketStatus = "WAITING" | "CALLED" | "SERVING" | "DONE" | "SKIPPED";

export type PublicVisitQueueTicket = {
  ticket_number: number;
  status: PublicVisitQueueTicketStatus;
  current_number: number; // Queue.current_number — "remaining" = ticket_number - current_number (MODELS.md § 4 / S6)
};

export type PublicVisit = {
  qr_token: string;
  status: "REGISTERED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  visit_date: string; // "YYYY-MM-DD"
  uses_wheelchair: boolean;
  patient: {
    full_name: string;
    hn_code: string;
    preferred_language: AppLocale;
  };
  /** Ordered by sequence_order; steps sharing a sequence_order run in parallel. */
  steps: PublicVisitStep[];
  /**
   * Three real states (see IMPLEMENT_PLAN.md Phase 3):
   *  1. null — every step is DONE/SKIPPED, nothing left to do.
   *  2. set, queue_ticket null — eligible to start, but no staff has started
   *     it yet at the Admin Portal, so no ticket exists.
   *  3. set, queue_ticket set — the full "walk there and watch the queue" flow.
   */
  next_step: PublicVisitStep | null;
  queue_ticket: PublicVisitQueueTicket | null;
};

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Server-only — used for the fast first paint in app/visit/[token]/page.tsx.
 * No cookie forwarding needed: this endpoint is public/AllowAny permanently.
 * Returns null on any non-2xx response (including 404 for an unknown/stale
 * token), which the caller turns into Next.js's notFound().
 */
export async function fetchVisitByTokenServer(token: string): Promise<PublicVisit | null> {
  const res = await fetch(`${BACKEND_URL}/api/visits/by-token/${token}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Client-only — used by PatientPortalView's polling loop. Goes through the
 * same-origin `/api/*` rewrite proxy (see next.config.ts), and never throws:
 * a failed poll (network hiccup, transient 5xx, ...) just returns null so the
 * caller can skip that round instead of crashing the page.
 */
export async function fetchVisitByTokenClient(token: string): Promise<PublicVisit | null> {
  try {
    const res = await fetch(`/api/visits/by-token/${token}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Client-only — Kiosk manual fallback (Phase 4): nobody can type a 64-char
 * qr_token by hand, so this looks up *today's* Visit by HN instead (see
 * backend/visits/views.py::visit_by_hn_today). Same null-on-failure contract
 * as fetchVisitByTokenClient — a 404 (no visit today for this HN) or a
 * network hiccup both just resolve to null for the caller to show as
 * "not found", not a crash.
 */
export async function fetchVisitByHnTodayClient(hnCode: string): Promise<PublicVisit | null> {
  try {
    const res = await fetch(`/api/visits/by-hn-today/${encodeURIComponent(hnCode)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** department_th/en is the clinical department name (e.g. "ห้องแล็บ") and is
 * preferred whenever non-empty; otherwise falls back to the node's own name. */
export function serviceStepLocationName(step: PublicVisitStep, locale: AppLocale): string {
  const sp = step.service_point;
  const department = locale === "th" ? sp.department_th : sp.department_en;
  if (department) return department;
  return locale === "th" ? sp.name_th : sp.name_en;
}
