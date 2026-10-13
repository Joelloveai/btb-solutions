import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { readDocumentFile } from "@/lib/document-storage";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { pdfIdFromKey } from "@/lib/site-diary";

export const dynamic = "force-dynamic";

/** The latest certificate PDF for a claim. Staff who may see financials. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });
  if (!can(session?.user?.staffRole, "financials.view")) return new Response("Not allowed", { status: 403 });
  const cert = await prisma.claimCertificate.findFirst({ where: { claimId: params.id }, orderBy: { certifiedAt: "desc" } });
  if (!cert?.pdfKey) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readDocumentFile({ id: pdfIdFromKey(cert.pdfKey), fileKey: cert.pdfKey, mimeType: "application/pdf" });
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${cert.certificateNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
