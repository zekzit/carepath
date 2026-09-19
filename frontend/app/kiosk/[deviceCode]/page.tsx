import { getKioskByDeviceCode, getVisitByQrToken } from "@/lib/portal-data";
import { KioskView } from "@/components/portal/KioskView";

// Identified by Node.device_code (MODELS.md § 1, node_type = KIOSK) — a
// fixed physical terminal, not a per-visit link like /visit/[token].
export default async function KioskPage({ params }: PageProps<"/kiosk/[deviceCode]">) {
  const { deviceCode } = await params;
  const kiosk = getKioskByDeviceCode(deviceCode);

  // TODO: the real flow starts with no visit — the kiosk scans the
  // patient's own QR (their Visit.qr_token) with its camera, then loads the
  // visit the same way /visit/[token] does. Seeding a demo visit here so the
  // "after scan" screen has something to render.
  const demoVisit = getVisitByQrToken("demo-token");

  return <KioskView kiosk={kiosk} demoVisit={demoVisit} />;
}
