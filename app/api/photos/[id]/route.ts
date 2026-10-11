import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { readPhotoFile } from "@/lib/photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Photos are never public. Who may see one:
 *  - staff:  any photo
 *  - client: progress photos, floor plans and product selections of projects belonging to their own client record
 *  - sub:    photos belonging to their own tasks and punch items
 * Anything else is a 404, so a guessed id reveals nothing.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = roleOf(session);
  if (!role || !session?.user) return new Response("Not signed in", { status: 401 });

  const photo = await prisma.photo.findUnique({ where: { id: params.id }, include: { project: true, task: true, punchIssue: true, punchFix: true } });
  if (!photo) return notFound();

  if (role === "client") {
    const user = session.user.id ? await prisma.clientUser.findUnique({ where: { id: session.user.id } }) : null;
    const visible = photo.kind === "PROGRESS" || photo.kind === "FLOORPLAN" || photo.kind === "SELECTION";
    if (!user || !visible || !photo.project.clientId || photo.project.clientId !== user.clientId) return notFound();
  } else if (role === "sub") {
    const user = session.user.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    const own =
      (photo.kind === "TASK" && photo.task?.subcontractorId === user?.subcontractorId) ||
      (photo.kind === "PUNCH" && (photo.punchIssue?.subcontractorId === user?.subcontractorId || photo.punchFix?.subcontractorId === user?.subcontractorId));
    if (!user?.subcontractorId || !own) return notFound();
  }

  let bytes: Uint8Array;
  try {
    bytes = await readPhotoFile(photo);
  } catch {
    return notFound();
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
