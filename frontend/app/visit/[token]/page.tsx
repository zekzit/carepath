import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchVisitByTokenServer } from "@/lib/api/public-visit";
import { PatientPortalView } from "@/components/portal/PatientPortalView";

export const metadata: Metadata = {
  title: "Patient Portal",
};

// No auth: the qr_token in the URL *is* the credential (see Visit.qr_token,
// MODELS.md § 3). Whoever holds the link/QR sees this visit.
export default async function VisitPage({ params }: PageProps<"/visit/[token]">) {
  const { token } = await params;
  const visit = await fetchVisitByTokenServer(token);

  if (!visit) {
    notFound();
  }

  return <PatientPortalView token={token} initialVisit={visit} />;
}
