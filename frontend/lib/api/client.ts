function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * fetch wrapper for CLIENT COMPONENTS only. Calls the same-origin `/api/*`
 * path (proxied to Django by next.config.ts) so the browser's own cookie
 * jar carries the session + CSRF cookies automatically — no manual cookie
 * plumbing needed here, unlike server-side calls (see lib/api/server.ts).
 *
 * Mutating requests get `X-CSRFToken` attached from the `csrftoken` cookie,
 * read fresh on every call rather than cached: Django rotates that cookie
 * on login (see backend/accounts/views.py), so a stale value 403s.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (typeof document === "undefined") {
    throw new Error("apiFetch is client-only — use lib/api/server.ts in Server Components/Actions.");
  }

  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = readCookie("csrftoken");
    if (csrfToken) headers.set("X-CSRFToken", csrfToken);
  }

  const res = await fetch(`/api${path}`, { ...init, headers, credentials: "include" });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
