import { createHash, randomBytes } from "node:crypto";
import { getServerSession } from "next-auth";
import { can } from "@/lib/permissions";
import { authOptions, roleOf } from "@/lib/auth";
import { buildCipaaPack } from "@/lib/cipaa-pack";
import { saveDocumentFile } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";
import { appendEvent, recorded } from "@/lib/timeline";
import { actorFromSession } from "@/lib/timeline-actor";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * "Generate CIPAA Pack": one PDF for adjudication. The file is also kept (R2 or local disk) with its
 * fingerprint, and generating it is itself recorded on the timeline, so what was handed over can be proven later.
 * Staff only.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });
  if (!can(session?.user?.staffRole, "financials.view")) return new Response("Not allowed", { status: 403 });
  const claimId = new URL(request.url).searchParams.get("claimId");
  const actor = actorFromSession(session);
  const pack = await buildCipaaPack(params.id, claimId, actor.name ?? "staff");
  if (!pack) return new Response("Not found", { status: 404 });

  const id = randomBytes(12).toString("hex");
  const pdfKey = `projects/${params.id}/packs/${id}.pdf`;
  const sha256 = createHash("sha256").update(pack.bytes).digest("hex");
  try {
    await saveDocumentFile({ id, fileKey: pdfKey, mimeType: "application/pdf" }, pack.bytes);
    await recorded(async (tx) => {
      await tx.evidencePack.create({
        data: { id, projectId: params.id, kind: "CIPAA", claimId: pack.claim?.id ?? null, pdfKey, sha256, eventCount: pack.count, headHash: pack.check.ok ? pack.check.head : null, generatedBy: actor.name ?? "staff" },
      });
      await appendEvent(tx, {
        projectId: params.id,
        type: "NOTE",
        actor,
        title: pack.claim ? `CIPAA pack generated for Progress Claim ${pack.claim.number}` : "CIPAA pack generated",
        description: `${pack.photoCount} photos, ${pack.diaryCount} site diaries. File fingerprint ${sha256}`,
        metadata: { action: "pack", packId: id, kind: "CIPAA", sha256, entries: pack.count },
      });
    });
  } catch (error) {
    console.error(error);
    return new Response("Could not save the pack. Please try again.", { status: 500 });
  }
  const safeName = pack.project.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-") || "project";
  return new Response(new Uint8Array(pack.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cipaa-pack-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
