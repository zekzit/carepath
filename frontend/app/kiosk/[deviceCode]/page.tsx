import { getKioskByDeviceCode } from "@/lib/portal-data";
import { KioskView } from "@/components/portal/KioskView";
import type { PublicVisit } from "@/lib/api/public-visit";

// Identified by Node.device_code (MODELS.md § 1, node_type = KIOSK) — a
// fixed physical terminal, not a per-visit link like /visit/[token].

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
      service_point: { id: 1, name_th: "จุดคัดกรอง", name_en: "Screening point", department_th: "", department_en: "" },
    },
    {
      id: 2,
      sequence_order: 2,
      status: "DONE",
      prerequisite_steps: [1],
      started_at: "2026-09-19T01:35:00Z",
      completed_at: "2026-09-19T02:10:00Z",
      service_point: { id: 2, name_th: "ห้องตรวจแพทย์", name_en: "Doctor consultation room", department_th: "OPD", department_en: "OPD" },
    },
    {
      id: 3,
      sequence_order: 3,
      status: "IN_PROGRESS",
      prerequisite_steps: [2],
      started_at: "2026-09-19T02:15:00Z",
      completed_at: null,
      service_point: { id: 3, name_th: "จุดเจาะเลือด", name_en: "Blood draw point", department_th: "ห้องแล็บ", department_en: "Laboratory" },
    },
    {
      id: 4,
      sequence_order: 3,
      status: "PENDING",
      prerequisite_steps: [2],
      started_at: null,
      completed_at: null,
      service_point: { id: 4, name_th: "ห้องเอกซเรย์", name_en: "X-ray room", department_th: "", department_en: "" },
    },
    {
      id: 5,
      sequence_order: 4,
      status: "PENDING",
      prerequisite_steps: [3, 4],
      started_at: null,
      completed_at: null,
      service_point: { id: 5, name_th: "ห้องยา", name_en: "Pharmacy", department_th: "", department_en: "" },
    },
  ],
  next_step: {
    id: 3,
    sequence_order: 3,
    status: "IN_PROGRESS",
    prerequisite_steps: [2],
    started_at: "2026-09-19T02:15:00Z",
    completed_at: null,
    service_point: { id: 3, name_th: "จุดเจาะเลือด", name_en: "Blood draw point", department_th: "ห้องแล็บ", department_en: "Laboratory" },
  },
  queue_ticket: { ticket_number: 24, status: "WAITING", current_number: 19 },
};

export default async function KioskPage({ params }: PageProps<"/kiosk/[deviceCode]">) {
  const { deviceCode } = await params;
  const kiosk = getKioskByDeviceCode(deviceCode);

  return <KioskView kiosk={kiosk} demoVisit={DEMO_VISIT} />;
}
