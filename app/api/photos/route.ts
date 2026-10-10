import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { MAX_PHOTO_BYTES, deletePhotoFile, detectImageType, savePhotoFile } from "@/lib/photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload one photo (multipart: file, kind, caption, projectId or taskId).
 *  - staff:  PROGRESS or FLOORPLAN for a project (shown to the client), or TASK for a task
 *  - sub:    TASK only, for an open task assigned to them
 * Clients cannot upload.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const role = roleOf(session);
  if (role !== "staff" && role !== "sub") return json({ error: "Not signed in" }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Could not read the upload." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a photo first." }, 400);
  if (file.size > MAX_PHOTO_BYTES) return json({ error: "That photo is too large (8 MB limit)." }, 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectImageType(bytes);
  if (!mimeType) return json({ error: "Only JPEG, PNG or WebP photos are accepted." }, 415);

  const kind = String(form.get("kind") ?? "PROGRESS");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 200) || null;

  let projectId: string;
  if (kind === "TASK") {
    const task = await prisma.task.findUnique({ where: { id: String(form.get("taskId") ?? "") } });
    if (!task) return json({ error: "Task not found." }, 404);
    if (role === "sub") {
      const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
      if (!user?.subcontractorId || task.subcontractorId !== user.subcontractorId) return json({ error: "Not allowed." }, 403);
      if (task.status !== "OPEN") return json({ error: "This task is already done." }, 409);
    }
    projectId = task.projectId;
  } else {
    if (role !== "staff") return json({ error: "Not allowed." }, 403);
    if (kind !== "PROGRESS" && kind !== "FLOORPLAN") return json({ error: "Unknown photo type." }, 400);
    const project = await prisma.project.findUnique({ where: { id: String(form.get("projectId") ?? "") } });
    if (!project) return json({ error: "Project not found." }, 404);
    projectId = project.id;
  }

  const photo = await prisma.photo.create({
    data: { projectId, kind, caption, mimeType, size: file.size, uploadedById: session?.user?.id ?? null },
  });
  try {
    await savePhotoFile(photo.id, bytes);
  } catch (error) {
    console.error(error);
    await prisma.photo.delete({ where: { id: photo.id } }).catch(() => undefined);
    await deletePhotoFile(photo.id).catch(() => undefined);
    return json({ error: "Could not save the photo. Please try again." }, 500);
  }
  return json({ id: photo.id }, 201);
}
