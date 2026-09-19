import { fetchKioskByDeviceCodeServer, type KioskInfo } from "@/lib/api/facility";
import { KioskView } from "@/components/portal/KioskView";
import type { PublicVisit } from "@/lib/api/public-visit";

// Identified by Node.device_code (MODELS.md § 1, node_type = KIOSK) — a
// fixed physical terminal, not a per-visit link like /visit/[token].
//
// Phase 7: the kiosk's position is now the origin for compass guidance
// (see lib/direction.ts + DirectionBlock.tsx). We resolve the real Node
// from the backend; if the device_code isn't registered yet (typical for
// fresh local dev), we synthesize a plausible kiosk at the floor of the
// demo Visit's next step so the demo button still shows a direction.

// TODO (Phase 4/6, out of scope here): the real flow starts with no visit —
// the kiosk scans the patient's own QR (their Visit.qr_token) with its
// camera or manual fallback, then loads the visit the same way
// /visit/[token] does. This fixture only exists so the "after scan" demo
// screen has something PublicVisit-shaped to render; it is not wired to the
// real backend.
const DEMO_VISIT: PublicVisit = {
  qr_token: "demo-token",
  status: "IN_PROGRESS",
  visit_date: "2026-09-19",
  uses_wheelchair: false,
  patient: { full_name: "สมชาย ใจดี", hn_code: "00219384", preferred_language: "th" },
  steps: [
    {
      id: 1,
      sequence_order: 1,
      status: "DONE",
      prerequisite_steps: [],
      started_at: "2026-09-19T01:15:00Z",
      completed_at: "2026-09-19T01:32:00Z",
      service_point: {
        id: 1,
        name_th: "จุดคัดกรอง",
        name_en: "Screening point",
        department_th: "",
        department_en: "",
        // Phase 7: position fields — sit on the same demo floor as the
        // fallback kiosk below so the compass has a meaningful direction
        // even when no real kiosk exists in the DB.
        pos_x: 480,
        pos_y: 220,
        floor_id: 1,
        floor_scale_m_per_px: 0.05,
        floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
        floor_name_en: "Floor 1 · OPD",
      },
    },
    {
      id: 2,
      sequence_order: 2,
      status: "DONE",
      prerequisite_steps: [1],
      started_at: "2026-09-19T01:35:00Z",
      completed_at: "2026-09-19T02:10:00Z",
      service_point: {
        id: 2,
        name_th: "ห้องตรวจแพทย์",
        name_en: "Doctor consultation room",
        department_th: "OPD",
        department_en: "OPD",
        pos_x: 320,
        pos_y: 360,
        floor_id: 1,
        floor_scale_m_per_px: 0.05,
        floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
        floor_name_en: "Floor 1 · OPD",
      },
    },
    {
      id: 3,
      sequence_order: 3,
      status: "IN_PROGRESS",
      prerequisite_steps: [2],
      started_at: "2026-09-19T02:15:00Z",
      completed_at: null,
      service_point: {
        id: 3,
        name_th: "จุดเจาะเลือด",
        name_en: "Blood draw point",
        department_th: "ห้องแล็บ",
        department_en: "Laboratory",
        pos_x: 600,
        pos_y: 520,
        floor_id: 1,
        floor_scale_m_per_px: 0.05,
        floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
        floor_name_en: "Floor 1 · OPD",
      },
    },
    {
      id: 4,
      sequence_order: 3,
      status: "PENDING",
      prerequisite_steps: [2],
      started_at: null,
      completed_at: null,
      service_point: {
        id: 4,
        name_th: "ห้องเอกซเรย์",
        name_en: "X-ray room",
        department_th: "",
        department_en: "",
        pos_x: 200,
        pos_y: 480,
        floor_id: 1,
        floor_scale_m_per_px: 0.05,
        floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
        floor_name_en: "Floor 1 · OPD",
      },
    },
    {
      id: 5,
      sequence_order: 4,
      status: "PENDING",
      prerequisite_steps: [3, 4],
      started_at: null,
      completed_at: null,
      service_point: {
        id: 5,
        name_th: "ห้องยา",
        name_en: "Pharmacy",
        department_th: "",
        department_en: "",
        pos_x: 720,
        pos_y: 180,
        floor_id: 1,
        floor_scale_m_per_px: 0.05,
        floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
        floor_name_en: "Floor 1 · OPD",
      },
    },
  ],
  next_steps: [
    {
      id: 3,
      sequence_order: 3,
      status: "IN_PROGRESS",
      service_point: {
        id: 3,
        name_th: "จุดเจาะเลือด",
        name_en: "Blood draw point",
        department_th: "ห้องแล็บ",
        department_en: "Laboratory",
        pos_x: 600,
        pos_y: 520,
        floor_id: 1,
        floor_scale_m_per_px: 0.05,
        floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
        floor_name_en: "Floor 1 · OPD",
      },
      queue_ticket: { ticket_number: 24, status: "WAITING", current_number: 19 },
    },
  ],
};

// Synthesized kiosk position for the demo path — same floor and scale as
// DEMO_VISIT, parked near the lobby so the demo button shows a sensible
// direction (e.g. "head SE to the lab"). Real kiosks come from the
// backend; this only kicks in when no Node with that device_code exists.
const FALLBACK_KIOSK: KioskInfo = {
  device_code: "DEMO",
  name_th: "คีออสก์สาธิต",
  name_en: "Demo kiosk",
  pos_x: 400,
  pos_y: 400,
  floor_id: 1,
  floor_scale_m_per_px: 0.05,
  floor_name_th: "ชั้น 1 อาคารผู้ป่วยนอก",
  floor_name_en: "Floor 1 · OPD",
};

export default async function KioskPage({ params }: PageProps<"/kiosk/[deviceCode]">) {
  const { deviceCode } = await params;
  const kiosk = (await fetchKioskByDeviceCodeServer(deviceCode)) ?? FALLBACK_KIOSK;

  return <KioskView kiosk={kiosk} demoVisit={DEMO_VISIT} />;
}