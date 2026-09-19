// Phase 7 — Kiosk compass guidance.
//
// Pure functions only; no React, no fetching, no DOM. Tested in isolation
// (see `app/kiosk/[deviceCode]/page.tsx`'s DEMO_VISIT for real coordinates
// and the curl output from /api/visits/by-token/... in IMPLEMENT_PLAN).
//
// Coordinate convention (matches MODELS.md § 1 / NodeSerializer / kiosk
// endpoint):
//   - pos_x / pos_y are in `Floor.plan_image` pixel space, **origin at
//     top-left, Y increases downward** (standard image coords).
//   - The patient is assumed to always be facing **north**, defined here as
//     the image's -Y direction (north on the floor plan = up).
//
// Bearing convention (degrees, clockwise from north):
//   - 0°   = N  (straight ahead)
//   - 90°  = E  (to the right)
//   - 180° = S  (behind)
//   - 270° = W  (to the left)
// Derived as `atan2(dx, -dy)` so dx and -dy are the components along
// (right, forward) in the patient's local frame.

export type NodePosition = {
  pos_x: number;
  pos_y: number;
  floor_id: number;
  floor_scale_m_per_px: number | null;
  floor_name_th: string;
  floor_name_en: string;
};

export type DirectionResult = {
  /** Bearing in degrees [0, 360), clockwise from north. */
  bearing_deg: number;
  /** Distance in metres, or null if scale isn't calibrated. */
  distance_m: number | null;
  /** 0=N, 1=NE, 2=E, 3=SE, 4=S, 5=SW, 6=W, 7=NW. */
  cardinal_index: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Short cardinal label (e.g. "NE"). */
  cardinal_short: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  /** True when origin and destination are on the same floor. */
  same_floor: boolean;
  /** True when both nodes are at the exact same point (no direction). */
  at_point: boolean;
};

export const CARDINAL_SHORT = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type CardinalShort = (typeof CARDINAL_SHORT)[number];

/** Returns a DirectionResult, or null if origin/destination are missing. */
export function computeDirection(origin: NodePosition, destination: NodePosition): DirectionResult {
  const dx = destination.pos_x - origin.pos_x;
  const dy = destination.pos_y - origin.pos_y;
  const sameFloor = origin.floor_id === destination.floor_id;
  const atPoint = dx === 0 && dy === 0;

  // atan2(dx, -dy): north=0 (dy<0,dx=0 → atan2(0, +) = 0); east=π/2; south=π; west=-π/2.
  const radians = Math.atan2(dx, -dy);
  const bearingDeg = ((radians * 180) / Math.PI + 360) % 360;

  // (bearing + 22.5) / 45 floor → 0..7, mapping into the 8 45°-wide buckets.
  const cardinal_index = Math.floor(((bearingDeg + 22.5) % 360) / 45) as DirectionResult["cardinal_index"];
  const cardinal_short = CARDINAL_SHORT[cardinal_index] as CardinalShort;

  let distanceM: number | null = null;
  if (sameFloor && origin.floor_scale_m_per_px != null && origin.floor_scale_m_per_px > 0) {
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);
    distanceM = pixelDistance * origin.floor_scale_m_per_px;
  }

  return {
    bearing_deg: bearingDeg,
    distance_m: distanceM,
    cardinal_index,
    cardinal_short,
    same_floor: sameFloor,
    at_point: atPoint,
  };
}

/** Round metres for display — <10 m to 1 decimal, otherwise nearest metre. */
export function formatDistance(meters: number): string {
  if (meters < 10) return meters.toFixed(1);
  return Math.round(meters).toString();
}