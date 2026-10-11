import { createHash } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { parsePhotoMetadata } from "@/lib/photo-metadata";
import { tradeTagFor } from "@/lib/trade-tag";
import { MAX_PHOTO_BYTES, deletePhotoFile, detectImageType, savePhotoFile } from "@/lib/photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload one photo (multipart: file, kind, caption, projectId or taskId).
 *  - staff:  PROGRESS or FLOORPLAN for a project (shown to the client), TASK for a task, PUNCH for a defect
 *  - sub:    TASK for an open task, or PUNCH for an open punch item, assigned to them
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

  const requestIdRaw = String(form.get("requestId") ?? "");
  const requestId = /^[A-Za-z0-9-]{8,64}$/.test(requestIdRaw) ? requestIdRaw : null;
  // A retried upload (the first one succeeded but the phone never heard back) must not create a second photo.
  if (requestId) {
    const existing = await prisma.photo.findUnique({ where: { clientRequestId: requestId } });
    if (existing) return json({ id: existing.id }, 200);
  }

  const metadata = parsePhotoMetadata(form);
  if (!metadata.ok) return json({ error: metadata.error }, 400);

  const kind = String(form.get("kind") ?? "PROGRESS");
  const caption = String(form.get("caption") ?? "").trim().slice(0, 200) || null;

  let projectId: string;
  let defaultTrade: string | null = null;
  if (kind === "TASK") {
    const task = await prisma.task.findUnique({ where: { id: String(form.get("taskId") ?? "") } });
    if (!task) return json({ error: "Task not found." }, 404);
    if (role === "sub") {
      const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
      if (!user?.subcontractorId || task.subcontractorId !== user.subcontractorId) return json({ error: "Not allowed." }, 403);
      if (task.status !== "OPEN") return json({ error: "This task is already done." }, 409);
      // A subcontractor's photo is filed under their own trade without them having to pick it.
      const sub = await prisma.subcontractor.findUnique({ where: { id: user.subcontractorId } });
      defaultTrade = tradeTagFor(sub?.trade);
    }
    projectId = task.projectId;
  } else if (kind === "PUNCH") {
    // The photo of a defect (staff, when raising it) or of its fix (the assigned subcontractor).
    if (role === "sub") {
      const item = await prisma.punchItem.findUnique({ where: { id: String(form.get("punchId") ?? "") } });
      if (!item) return json({ error: "Punch item not found." }, 404);
      const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
      if (!user?.subcontractorId || item.subcontractorId !== user.subcontractorId) return json({ error: "Not allowed." }, 403);
      if (item.status !== "OPEN") return json({ error: "This item is already fixed." }, 409);
      defaultTrade = item.trade;
      projectId = item.projectId;
    } else {
      const project = await prisma.project.findUnique({ where: { id: String(form.get("projectId") ?? "") } });
      if (!project) return json({ error: "Project not found." }, 404);
      projectId = project.id;
    }
  } else {
    if (role !== "staff") return json({ error: "Not allowed." }, 403);
    if (kind !== "PROGRESS" && kind !== "FLOORPLAN" && kind !== "SELECTION") return json({ error: "Unknown photo type." }, 400);
    const project = await prisma.project.findUnique({ where: { id: String(form.get("projectId") ?? "") } });
    if (!project) return json({ error: "Project not found." }, 404);
    projectId = project.id;
  }

  let photo;
  try {
    photo = await prisma.photo.create({
      data: {
        projectId,
        kind,
        caption,
        mimeType,
        size: file.size,
        uploadedById: session?.user?.id ?? null,
        clientRequestId: requestId,
        ...metadata.data,
        trade: metadata.data.trade ?? defaultTrade,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
    });
  } catch (error) {
    // Two copies of the same retry racing each other: the loser just returns the winner's photo.
    const existing = requestId ? await prisma.photo.findUnique({ where: { clientRequestId: requestId } }) : null;
    if (existing) return json({ id: existing.id }, 200);
    throw error;
  }
  try {
    await savePhotoFile(photo, bytes);
  } catch (error) {
    console.error(error);
    await prisma.photo.delete({ where: { id: photo.id } }).catch(() => undefined);
    await deletePhotoFile(photo).catch(() => undefined);
    return json({ error: "Could not save the photo. Please try again." }, 500);
  }
  return json({ id: photo.id }, 201);
}
