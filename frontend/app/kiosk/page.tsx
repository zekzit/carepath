import { fetchKiosksServer } from "@/lib/api/kiosk";
import { KioskListView } from "@/components/portal/KioskListView";

// Public kiosk picker — renders every KIOSK node registered in the facility
// graph with a client-side search filter. Selecting a kiosk links to its
// `/kiosk/[deviceCode]` page (the existing per-terminal portal entry). All
// data is fetched server-side on first paint; the client component only
// re-filters locally as the user types.
export default async function KioskListPage() {
  const kiosks = await fetchKiosksServer();
  return <KioskListView kiosks={kiosks} />;
}
