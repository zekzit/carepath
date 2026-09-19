// Pure helper for Kiosk camera QR scanning (Phase 6). There is no real
// QR-generation feature anywhere in this codebase yet (out of scope for this
// phase), so this deliberately handles both plausible shapes a future QR
// payload might take:
//
//   1. A bare token string, e.g. "a1b2c3...".
//   2. A full URL whose last path segment is the token, e.g.
//      "https://kiosk.example.com/visit/a1b2c3..." (matches the existing
//      app/visit/[token]/page.tsx route) — including a *relative* path like
//      "/visit/a1b2c3..." with no scheme/host.
//
// Anything that decodes to empty/whitespace is invalid and returns null.
export function extractQrToken(decoded: string): string | null {
  const trimmed = decoded.trim();
  if (!trimmed) return null;

  // Try as an absolute URL first (e.g. "https://host/visit/<token>").
  try {
    const url = new URL(trimmed);
    return lastPathSegment(url.pathname);
  } catch {
    // Not an absolute URL — fall through.
  }

  // Not a URL — could still be a URL *path* (e.g. "/visit/<token>") or a bare
  // token. Treat anything containing a "/" as a path and take its last
  // segment; otherwise return the trimmed string as-is.
  if (trimmed.includes("/")) {
    return lastPathSegment(trimmed);
  }

  return trimmed;
}

function lastPathSegment(path: string): string | null {
  const segments = path.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  return last ? last : null;
}
