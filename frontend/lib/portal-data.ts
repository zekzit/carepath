import type { AppLocale } from "@/i18n/locales";

// Shapes below mirror visits.VisitStep / queues.Queue (see MODELS.md § 3-4).
// TODO: replace the two get* functions with real fetches once the backend
// exposes them, e.g. GET /api/visits/:qrToken and GET /api/kiosks/:deviceCode.

export type VisitStepStatus = "DONE" | "IN_PROGRESS" | "PENDING" | "SKIPPED";

export type VisitStepView = {
  id: string;
  sequenceOrder: number;
  nameTh: string;
  nameEn: string;
  status: VisitStepStatus;
  completedAtLabel?: string;
};

export type VisitView = {
  qrToken: string;
  patientName: string;
  hnCode: string;
  appointmentDateLabel: string;
  preferredLanguage: AppLocale;
  /** Ordered by sequenceOrder; steps sharing a sequenceOrder are a parallel group (fan-out/fan-in — MODELS.md § 2-3). */
  steps: VisitStepView[];
  nextStep: {
    nameTh: string;
    nameEn: string;
    locationTh: string;
    locationEn: string;
    walkTimeMinutes: number;
  };
  queue: {
    ticketNumber: string;
    currentNumber: string;
    remaining: number;
    avgWaitMinutes: number;
    locationTh: string;
    locationEn: string;
  };
};

const MOCK_VISIT: Omit<VisitView, "qrToken"> = {
  patientName: "สมชาย ใจดี",
  hnCode: "00219384",
  appointmentDateLabel: "19 ก.ย. 2569",
  preferredLanguage: "th",
  steps: [
    { id: "screening", sequenceOrder: 1, nameTh: "คัดกรอง", nameEn: "Screening", status: "DONE", completedAtLabel: "08:32" },
    { id: "opd", sequenceOrder: 2, nameTh: "ตรวจแพทย์ (OPD)", nameEn: "Doctor consultation (OPD)", status: "DONE", completedAtLabel: "09:10" },
    { id: "blood", sequenceOrder: 3, nameTh: "เจาะเลือด", nameEn: "Blood draw", status: "IN_PROGRESS" },
    { id: "xray", sequenceOrder: 3, nameTh: "เอกซเรย์", nameEn: "X-ray", status: "PENDING" },
    { id: "pharmacy", sequenceOrder: 4, nameTh: "รับยา", nameEn: "Pharmacy", status: "PENDING" },
  ],
  nextStep: {
    nameTh: "ห้องแล็บ (เจาะเลือด)",
    nameEn: "Lab (blood draw)",
    locationTh: "ชั้น 2 อาคาร B",
    locationEn: "2nd floor, Building B",
    walkTimeMinutes: 4,
  },
  queue: {
    ticketNumber: "B-24",
    currentNumber: "B-19",
    remaining: 5,
    avgWaitMinutes: 12,
    locationTh: "ห้องแล็บ",
    locationEn: "the lab",
  },
};

export function getVisitByQrToken(qrToken: string): VisitView {
  return { ...MOCK_VISIT, qrToken };
}

export type KioskDevice = {
  deviceCode: string;
  locationTh: string;
  locationEn: string;
};

export function getKioskByDeviceCode(deviceCode: string): KioskDevice {
  return { deviceCode, locationTh: "จุดคัดกรอง A", locationEn: "Screening Point A" };
}
