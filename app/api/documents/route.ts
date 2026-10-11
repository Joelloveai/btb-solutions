import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { DOCUMENT_TYPES, PHOTO_TRADES } from "@/lib/constants";
import { MAX_DOCUMENT_BYTES, detectDocumentType, documentNameKey } from "@/lib/document-files";
import { deleteDocumentFile, documentFileKey, saveDocumentFile } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { appendEvent, recorded } from "@/lib/timeline";
import { actorFromSession } from "@/lib/timeline-actor";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Upload a document (staff only). Uploading a name that already exists in the project creates the NEXT
 * VERSION of it and makes that the current one; older versions are kept and stay downloadable by staff.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return json({ error: "Not signed in" }, 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Could not read the upload." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "Choose a file first." }, 400);
  if (file.size > MAX_DOCUMENT_BYTES) return json({ error: "That file is too large (25 MB limit)." }, 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectDocumentType(bytes, file.name);
  if (!detected) return json({ error: "Only PDF, image, DWG, Word or Excel files are accepted." }, 415);

  const requestIdRaw = String(form.get("requestId") ?? "");
  const requestId = /^[A-Za-z0-9-]{8,64}$/.test(requestIdRaw) ? requestIdRaw : null;
  if (requestId) {
    const existing = await prisma.document.findUnique({ where: { clientRequestId: requestId } });
    if (existing) return json({ id: existing.id, version: existing.version }, 200); // a retry of an upload that already worked
  }

  const type = String(form.get("type") ?? "Drawing");
  if (!(DOCUMENT_TYPES as readonly string[]).includes(type)) return json({ error: "Unknown document type." }, 400);
  const trade = String(form.get("trade") ?? "").trim();
  if (trade && !(PHOTO_TRADES as readonly string[]).includes(trade)) return json({ error: "Unknown trade." }, 400);
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 120) return json({ error: "Enter a name for the document (up to 120 characters)." }, 400);
  const note = String(form.get("note") ?? "").trim().slice(0, 300) || null;
  const project = await prisma.project.findUnique({ where: { id: String(form.get("projectId") ?? "") } });
  if (!project) return json({ error: "Project not found." }, 404);

  const id = randomBytes(12).toString("hex");
  const fileKey = documentFileKey({ projectId: project.id, id, ext: detected.ext });
  const nameKey = documentNameKey(name);
  const uploadedById = session?.user?.id ?? null;
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  // Store the bytes first, so there is never a document row without a file behind it.
  try {
    await saveDocumentFile({ id, fileKey, mimeType: detected.mime }, bytes);
  } catch (error) {
    console.error(error);
    return json({ error: "Could not save the file. Please try again." }, 500);
  }

  // Two uploads of the same name at once would both want the same version number: the unique index
  // refuses the second, which simply asks again and gets the next number.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const created = await recorded(async (tx) => {
        const latest = await tx.document.aggregate({ where: { projectId: project.id, nameKey }, _max: { version: true } });
        const version = (latest._max.version ?? 0) + 1;
        await tx.document.updateMany({ where: { projectId: project.id, nameKey }, data: { isCurrent: false } });
        const doc = await tx.document.create({
          data: {
            id,
            projectId: project.id,
            name,
            nameKey,
            type,
            trade: trade || null,
            version,
            isCurrent: true,
            fileKey,
            fileName: file.name.slice(0, 200),
            mimeType: detected.mime,
            size: file.size,
            sha256,
            note,
            uploadedById,
            clientRequestId: requestId,
          },
        });
        await appendEvent(tx, {
          projectId: project.id,
          type: "DOCUMENT_UPLOADED",
          actor: actorFromSession(session),
          title: `${type === "Drawing" ? "Drawing" : "Document"} uploaded: ${name} (version ${version})`,
          description: note,
          metadata: { action: "added", documentId: id, version, type, trade: trade || null, sha256 },
        });
        return doc;
      });
      return json({ id: created.id, version: created.version }, 201);
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (duplicate && requestId) {
        const existing = await prisma.document.findUnique({ where: { clientRequestId: requestId } });
        if (existing) {
          await deleteDocumentFile({ id, fileKey, mimeType: detected.mime }).catch(() => undefined);
          return json({ id: existing.id, version: existing.version }, 200);
        }
      }
      if (!duplicate || attempt === 3) {
        console.error(error);
        await deleteDocumentFile({ id, fileKey, mimeType: detected.mime }).catch(() => undefined);
        return json({ error: "Could not save the document. Please try again." }, 500);
      }
    }
  }
  return json({ error: "Could not save the document. Please try again." }, 500);
}
