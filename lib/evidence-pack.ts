import { COMPANY } from "@/lib/company-config";
import { formatDateTime } from "@/lib/format";
import { PdfKit } from "@/lib/pdf-kit";
import { readPhotoFile } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import { verifyChain } from "@/lib/timeline";

const MAX_EMBEDDED_PHOTOS = 120;

const meta = (text: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

export function letterhead(pdf: PdfKit) {
  pdf.text(COMPANY.name, { size: 16, bold: true, gap: 0 });
  pdf.text(`CIDB ${COMPANY.cidbGrade}  ·  Reg. no. ${COMPANY.cidbRegNo}`, { size: 9, color: [0.35, 0.35, 0.4], gap: 0 });
  for (const line of COMPANY.addressLines) pdf.text(line, { size: 9, color: [0.35, 0.35, 0.4], gap: 0 });
  pdf.space(8);
}

/** The "verification page": the chain check and every event's fingerprint, so anyone can re-check the record. */
export function verificationSection(pdf: PdfKit, events: Parameters<typeof verifyChain>[0]) {
  const check = verifyChain(events);
  pdf.newPage();
  pdf.heading("Verification");
  pdf.text(
    "Each entry on the project timeline carries a SHA-256 fingerprint of its own content and of the entry before it. Changing or removing any past entry changes every fingerprint after it, so the record cannot be altered without it showing. The list below can be re-computed independently from the entries in this pack.",
    { size: 9, gap: 6 },
  );
  pdf.pair("Entries", String(check.count));
  pdf.pair("Chain check", check.ok ? "PASSED: every entry matches its fingerprint and follows the one before." : `FAILED at entry ${check.brokenAtSeq}: ${check.reason}`);
  if (check.ok && check.head) pdf.pair("Latest fingerprint", check.head);
  pdf.space(6);
  for (const e of events) {
    pdf.text(`#${String(e.seq).padStart(4, "0")}  ${e.hash}`, { size: 7, mono: true, gap: 0 });
  }
  return check;
}

/** The full timeline as a PDF: header, every event in order, every photo with its time and GPS, then verification. */
export async function buildTimelinePack(projectId: string, preparedBy: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  const events = await prisma.timelineEvent.findMany({ where: { projectId }, orderBy: { seq: "asc" } });
  const generatedAt = new Date();
  const pdf = await PdfKit.create(`Evidence pack: ${project.name}`, `${project.name}  ·  Evidence pack generated ${formatDateTime(generatedAt)}`);

  letterhead(pdf);
  pdf.text("EVIDENCE PACK", { size: 20, bold: true, gap: 6 });
  pdf.pair("Project", project.name);
  if (project.clientName) pdf.pair("Client", project.clientName);
  pdf.pair("Prepared", `${formatDateTime(generatedAt)} (Malaysia time)`);
  pdf.pair("Prepared by", preparedBy);
  pdf.pair("Entries", String(events.length));
  if (events[0]) pdf.pair("Period", `${formatDateTime(events[0].capturedAt)} to ${formatDateTime(events[events.length - 1]!.capturedAt)}`);

  pdf.heading("Timeline");
  if (events.length === 0) pdf.text("No entries have been recorded yet.");
  for (const e of events) {
    pdf.ensure(40);
    pdf.text(`${formatDateTime(e.capturedAt)}  ·  ${e.actorName ?? e.actorRole}`, { size: 8, color: [0.4, 0.4, 0.45], gap: 0 });
    pdf.text(e.title, { size: 10, bold: true, gap: 0 });
    if (e.description) pdf.text(e.description, { size: 9, indent: 8, gap: 0 });
    if (e.latitude !== null && e.longitude !== null) pdf.text(`GPS ${e.latitude.toFixed(6)}, ${e.longitude.toFixed(6)}`, { size: 8, color: [0.4, 0.4, 0.45], indent: 8, gap: 0 });
    pdf.space(6);
  }

  // Photos, in the order they were recorded.
  const photoEvents = events.filter((e) => e.eventType === "PHOTO" && meta(e.metadata).action === "added" && typeof meta(e.metadata).photoId === "string");
  pdf.newPage();
  pdf.heading("Photographs");
  if (photoEvents.length === 0) pdf.text("No photographs have been recorded.");
  const photos = new Map((await prisma.photo.findMany({ where: { id: { in: photoEvents.map((e) => meta(e.metadata).photoId as string) } } })).map((p) => [p.id, p]));
  let embedded = 0;
  for (const e of photoEvents) {
    const m = meta(e.metadata);
    const photo = photos.get(m.photoId as string);
    pdf.ensure(220);
    pdf.text(`${formatDateTime(e.capturedAt)}  ·  ${e.actorName ?? e.actorRole}`, { size: 9, bold: true, gap: 0 });
    const where = [photo?.phase, photo?.trade, photo?.location].filter(Boolean).join(" · ");
    if (photo?.caption || where) pdf.text([photo?.caption, where].filter(Boolean).join(" — "), { size: 9, gap: 0 });
    pdf.text(
      e.latitude !== null && e.longitude !== null ? `GPS ${e.latitude.toFixed(6)}, ${e.longitude.toFixed(6)}${photo?.accuracy ? ` (±${Math.round(photo.accuracy)} m)` : ""}` : "No GPS recorded",
      { size: 8, color: [0.4, 0.4, 0.45], gap: 0 },
    );
    pdf.text(`SHA-256 ${typeof m.sha256 === "string" ? m.sha256 : "n/a"}`, { size: 6.5, mono: true, color: [0.4, 0.4, 0.45], gap: 2 });
    if (!photo) pdf.text("(This photo was removed after it was recorded; the entry and fingerprint remain.)", { size: 8, gap: 8 });
    else if (embedded >= MAX_EMBEDDED_PHOTOS) pdf.text("(Image not embedded: pack limit reached. It is in the Evidence Package ZIP.)", { size: 8, gap: 8 });
    else {
      try {
        const ok = await pdf.image(await readPhotoFile(photo), photo.mimeType, 300, 210);
        if (ok) embedded += 1;
        else pdf.text(`(${photo.mimeType} image not embedded. It is in the Evidence Package ZIP.)`, { size: 8, gap: 8 });
      } catch {
        pdf.text("(The image file could not be read.)", { size: 8, gap: 8 });
      }
      pdf.space(8);
    }
  }

  const check = verificationSection(pdf, events);
  return { bytes: await pdf.finish(), project, check, count: events.length };
}
