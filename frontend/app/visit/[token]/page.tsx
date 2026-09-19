import { getVisitByQrToken } from "@/lib/portal-data";
import { PatientPortalView } from "@/components/portal/PatientPortalView";

// No auth: the qr_token in the URL *is* the credential (see Visit.qr_token,
// MODELS.md § 3). Whoever holds the link/QR sees this visit.
export default async function VisitPage({ params }: PageProps<"/visit/[token]">) {
  const { token } = await params;
  const visit = getVisitByQrToken(token);

  return <PatientPortalView visit={visit} />;
}
