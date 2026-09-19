// Kiosk device lookup by Node.device_code (MODELS.md § 1, node_type = KIOSK)
// — still mock, Phase 4 scope (see IMPLEMENT_PLAN.md). The Patient Portal's
// visit data used to live here too (VisitView/VisitStepView/getVisitByQrToken)
// but that's now the real backend — see lib/api/public-visit.ts.

export type KioskDevice = {
  deviceCode: string;
  locationTh: string;
  locationEn: string;
};

export function getKioskByDeviceCode(deviceCode: string): KioskDevice {
  return { deviceCode, locationTh: "จุดคัดกรอง A", locationEn: "Screening Point A" };
}
