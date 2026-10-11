import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { readDocumentFile } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { pdfIdFromKey } from "@/lib/site-diary";

export const dynamic = "force-dynamic";

/** The signed site diary as a PDF. Staff only. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });
  const diary = await prisma.siteDiary.findUnique({ where: { id: params.id } });
  if (!diary?.pdfKey) return new Response("Not found", { status: 404 });
  let bytes: Uint8Array;
  try {
    bytes = await readDocumentFile({ id: pdfIdFromKey(diary.pdfKey), fileKey: diary.pdfKey, mimeType: "application/pdf" });
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="site-diary-${diary.date.toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
