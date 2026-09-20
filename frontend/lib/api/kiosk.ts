const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export type Kiosk = {
  deviceCode: string;
  nameTh: string;
  nameEn: string;
  floorId: number | null;
  isActive: boolean;
};

type KioskListItem = {
  device_code: string;
  name_th: string;
  name_en: string;
  floor_id: number;
  is_active: boolean;
};

/**
 * Public kiosk picker (`app/kiosk/page.tsx`) — lists every KIOSK node so a
 * staffer can pick which terminal they're configuring and jump to its
 * `/kiosk/[deviceCode]` URL. Reads from the dedicated public/AllowAny
 * `GET /api/facility/kiosks` endpoint (`backend/facility/views.py`).
 *
 * This can't reuse `GET /api/facility/nodes` (`NodeViewSet`): that sits
 * behind `RoleRequired`, which rejects unauthenticated requests outright,
 * and this picker page has no staff session of its own — same reasoning as
 * `fetchVisitByTokenServer` in `lib/api/public-visit.ts`.
 *
 * Returns `[]` on any failure (network hiccup, 5xx, ...) rather than
 * throwing — a picker with zero items is recoverable UX; an exception would
 * 500 the whole page.
 */
export async function fetchKiosksServer(): Promise<Kiosk[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/facility/kiosks`, { cache: "no-store" });
    if (!res.ok) return [];
    const items = (await res.json()) as KioskListItem[];
    return items.map((item) => ({
      deviceCode: item.device_code,
      nameTh: item.name_th,
      nameEn: item.name_en,
      floorId: item.floor_id,
      isActive: item.is_active,
    }));
  } catch {
    return [];
  }
}
