import { apiFetch } from "./client";
import { createResourceClient } from "./resource";

// Phase 7: kiosk node payload, used by the Kiosk Portal to compute a
// straight-line bearing from the kiosk to the patient's next service point.
// Mirrors `backend/facility/views.py::kiosk_by_device_code`.
export type KioskInfo = {
  // The kiosk's own Node id — used as the routing engine's origin node
  // (see fetchRouteClient below / RouteInstructions.tsx).
  id: number;
  device_code: string;
  name_th: string;
  name_en: string;
  pos_x: number;
  pos_y: number;
  floor_id: number;
  floor_scale_m_per_px: number | null;
  floor_name_th: string;
  floor_name_en: string;
};

// Phase 8: scannable location-node payload — junction / vertical connector /
// entrance — used by the Patient Portal to mark "where am I" and compute a
// bearing to the next service point. Mirrors
// `backend/facility/views.py::location_node_by_qr`.
export type LocationNodeInfo = {
  id: number;
  node_type: "JUNCTION" | "VERTICAL_CONNECTOR" | "ENTRANCE";
  name_th: string;
  name_en: string;
  pos_x: number;
  pos_y: number;
  floor_id: number;
  floor_scale_m_per_px: number | null;
  floor_name_th: string;
  floor_name_en: string;
};

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/**
 * Server-only — used for the fast first paint of /kiosk/[deviceCode]. No
 * cookie forwarding needed: this endpoint is public/AllowAny permanently.
 * Returns null on any non-2xx response (including 404 for an unknown kiosk
 * device_code), so the caller can decide to render notFound() or a fallback.
 */
export async function fetchKioskByDeviceCodeServer(deviceCode: string): Promise<KioskInfo | null> {
  const res = await fetch(`${BACKEND_URL}/api/facility/kiosks/${encodeURIComponent(deviceCode)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Client-only — used by the Patient Portal's "scan where am I" flow. Goes
 * through the same-origin `/api/*` rewrite proxy (see next.config.ts), and
 * never throws. Returns null for any non-2xx (404 unknown qr, 400 wrong
 * node_type) so the caller can show a unified "not found / not scannable"
 * message — see `fetchVisitByTokenClient` for the same shape.
 */
export async function fetchLocationNodeByQrClient(qrCode: string): Promise<LocationNodeInfo | null> {
  try {
    const res = await fetch(`/api/facility/nodes/by-location-qr/${encodeURIComponent(qrCode)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export type Building = {
  id: number;
  name_th: string;
  name_en: string;
  code: string;
};
export type BuildingInput = Omit<Building, "id">;

export type Floor = {
  id: number;
  building: number;
  level_no: number;
  name_th: string;
  name_en: string;
  plan_scale_m_per_px: number | null;
  // Full absolute URL (e.g. "http://127.0.0.1:8000/media/floor_plans/xyz.png") or null
  // if never uploaded — usable directly as an <img src>. Read-only in practice: it is
  // never sent as part of `FloorInput` (see `uploadFloorPlanImage` below for the
  // separate multipart upload path).
  plan_image: string | null;
};
// The plain-JSON create/update shape used by the Floors CRUD form. Deliberately
// excludes `plan_image` — uploading/replacing the floor plan image is a separate
// multipart request (see `uploadFloorPlanImage`), not part of this JSON payload.
export type FloorInput = Omit<Floor, "id" | "plan_image">;

export const NODE_TYPES = ["SERVICE_POINT", "JUNCTION", "VERTICAL_CONNECTOR", "KIOSK", "ENTRANCE"] as const;
export type NodeType = (typeof NODE_TYPES)[number];

// Named FacilityNode (not "Node") to avoid clashing with the DOM's global Node type.
export type FacilityNode = {
  id: number;
  floor: number;
  node_type: NodeType;
  name_th: string;
  name_en: string;
  pos_x: number;
  pos_y: number;
  vertical_group: string;
  location_qr_code: string | null;
  service_point_code: string | null;
  department_th: string;
  department_en: string;
  is_active: boolean;
  device_code: string | null;
};
export type FacilityNodeInput = Omit<FacilityNode, "id">;

export const EDGE_TYPES = ["CORRIDOR", "ELEVATOR", "STAIRS", "RAMP"] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export type FacilityEdge = {
  id: number;
  from_node: number;
  to_node: number;
  distance_m: number;
  edge_type: EdgeType;
  walk_time_sec: number;
  is_bidirectional: boolean;
  wheelchair_accessible: boolean;
};
// `distance_m` is optional on write (Phase 5): omit the key entirely to let the
// backend auto-calculate it from the two nodes' positions and the floor's
// `plan_scale_m_per_px` — see EdgesSection.tsx / FloorMapSection.tsx for callers.
export type FacilityEdgeInput = Omit<FacilityEdge, "id" | "distance_m"> & { distance_m?: number };

export const buildingsApi = createResourceClient<Building, BuildingInput>("/facility/buildings");
export const floorsApi = createResourceClient<Floor, FloorInput>("/facility/floors");
export const nodesApi = createResourceClient<FacilityNode, FacilityNodeInput>("/facility/nodes");
export const edgesApi = createResourceClient<FacilityEdge, FacilityEdgeInput>("/facility/edges");

/**
 * Uploads (or replaces) a Floor's plan image via multipart PATCH. Deliberately
 * bypasses `floorsApi.update()` (which always `JSON.stringify`s its payload —
 * wrong for a file) and calls `apiFetch` directly with a `FormData` body, which
 * `apiFetch` now knows not to force `Content-Type: application/json` onto.
 */
export function uploadFloorPlanImage(floorId: number, file: File): Promise<Floor> {
  const formData = new FormData();
  formData.append("plan_image", file);
  return apiFetch<Floor>(`/facility/floors/${floorId}`, { method: "PATCH", body: formData });
}

// FR-13/FR-12/FR-17: real shortest-path routing over the facility graph —
// replaces the straight-line-only compass bearing in lib/direction.ts.
// Mirrors `backend/facility/views.py::route_between_nodes` /
// `backend/facility/routing.py::RouteLeg`/`RouteResult`.
export type RouteLeg = {
  from_node_id: number;
  to_node_id: number;
  edge_type: EdgeType;
  distance_m: number;
  walk_time_sec: number;
  turn: "LEFT" | "RIGHT" | "STRAIGHT" | null;
  to_floor_id: number;
  to_floor_name_th: string;
  to_floor_name_en: string;
  to_pos_x: number;
  to_pos_y: number;
};

export type RouteResult = {
  reachable: boolean;
  total_distance_m: number;
  total_time_sec: number;
  legs: RouteLeg[];
};

/**
 * Client-only — used by RouteInstructions.tsx to fetch turn-by-turn
 * directions for the Patient Portal / Kiosk. Goes through the same-origin
 * `/api/*` rewrite proxy, and never throws: any non-2xx (400 bad node ids)
 * or network hiccup just returns null so the caller can fall back to the
 * compass-only DirectionBlock — same contract as fetchLocationNodeByQrClient.
 */
export async function fetchRouteClient(
  fromNodeId: number,
  toNodeId: number,
  wheelchair: boolean,
): Promise<RouteResult | null> {
  try {
    const params = new URLSearchParams({
      from_node: String(fromNodeId),
      to_node: String(toNodeId),
      wheelchair: wheelchair ? "true" : "false",
    });
    const res = await fetch(`/api/facility/route?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
