import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { documentWhereForSub } from "@/lib/document-access";
import { safeDownloadName } from "@/lib/document-files";
import { readDocumentFile } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404 });
const INLINE = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/**
 * Who may open a document:
 *  - staff:  any version
 *  - sub:    only the CURRENT version of a Drawing for their own trade, on a project they have work on
 *  - client: nothing
 * Anything else is "not found", so a guessed id reveals nothing.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = roleOf(session);
  if (!role || !session?.user) return new Response("Not signed in", { status: 401 });
  if (role === "client") return notFound();

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return notFound();

  if (role === "sub") {
    const user = session.user.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    if (!user?.subcontractorId) return notFound();
    const allowed = await prisma.document.findFirst({ where: { id: doc.id, ...(await documentWhereForSub(user.subcontractorId)) } });
    if (!allowed) return notFound();
  }

  let bytes: Uint8Array;
  try {
    bytes = await readDocumentFile(doc);
  } catch {
    return notFound();
  }
  const ext = doc.fileKey.split(".").pop() ?? "bin";
  const inline = INLINE.has(doc.mimeType);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeDownloadName(`${doc.name} v${doc.version}`, ext)}"`,
      "X-Content-Type-Options": "nosniff",
      // Content-Security-Policy sandbox stops a PDF or image from running anything in this site's origin.
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
