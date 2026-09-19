const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export type Kiosk = {
  deviceCode: string;
  nameTh: string;
  nameEn: string;
  floorId: number | null;
  isActive: boolean;
};

type FacilityNode = {
  id: number;
  floor: number;
  node_type: "SERVICE_POINT" | "JUNCTION" | "VERTICAL_CONNECTOR" | "KIOSK" | "ENTRANCE";
  name_th: string;
  name_en: string;
  device_code: string | null;
  is_active: boolean;
};

/**
 * Public kiosk picker (`app/kiosk/page.tsx`) — lists every KIOSK node so a
 * staffer can pick which terminal they're configuring and jump to its
 * `/kiosk/[deviceCode]` URL. Reads from the public/AllowAny
 * `GET /api/facility/nodes` endpoint (`backend/facility/viewsets.py`) and
 * filters `node_type=KIOSK` + non-null `device_code` on the server. No
 * auth: kiosk terminals have no account/session of their own (same reasoning
 * as `fetchVisitByTokenServer` in `lib/api/public-visit.ts`).
 *
 * Returns `[]` on any failure (network hiccup, 5xx, ...) rather than
 * throwing — a picker with zero items is recoverable UX; an exception would
 * 500 the whole page.
 */
export async function fetchKiosksServer(): Promise<Kiosk[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/facility/nodes`, { cache: "no-store" });
    if (!res.ok) return [];
    const nodes = (await res.json()) as FacilityNode[];
    return nodes
      .filter((n) => n.node_type === "KIOSK" && n.device_code)
      .map((n) => ({
        deviceCode: n.device_code as string,
        nameTh: n.name_th,
        nameEn: n.name_en,
        floorId: n.floor,
        isActive: n.is_active,
      }))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  } catch {
    return [];
  }
}
