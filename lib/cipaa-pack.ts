import { Prisma } from "@prisma/client";
import { COMPANY } from "@/lib/company-config";
import { letterhead, verificationSection } from "@/lib/evidence-pack";
import { formatDate, formatDateTime } from "@/lib/format";
import { PdfKit } from "@/lib/pdf-kit";
import { readPhotoFile } from "@/lib/photos";
import { prisma } from "@/lib/prisma";
import { rm } from "@/lib/timeline";

const MAX_EMBEDDED_PHOTOS = 120;
const dec = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const sum = (values: Prisma.Decimal.Value[]) => values.reduce<Prisma.Decimal>((t, x) => t.plus(x), dec(0));
const dayEnd = (d: Date) => new Date(d.getTime() + 86_400_000 - 1);

/**
 * The CIPAA pack: everything a contractor needs to put a payment claim in front of an adjudicator,
 * in the order an adjudicator reads it. It covers the period of one progress claim (default: the latest).
 */
export async function buildCipaaPack(projectId: string, claimId: string | null, preparedBy: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { claims: { orderBy: { number: "asc" }, include: { payments: true } }, changeOrders: { orderBy: { date: "asc" } }, siteDiaries: { orderBy: { date: "asc" } }, photos: { orderBy: { takenAt: "asc" } } },
  });
  if (!project) return null;
  const claim = (claimId ? project.claims.find((c) => c.id === claimId) : null) ?? project.claims[project.claims.length - 1] ?? null;
  const previous = claim ? project.claims.filter((c) => c.number < claim.number).pop() ?? null : null;
  // Period: after the previous claim up to and including this one (or everything, if no claim has been issued).
  const periodStart = previous ? new Date(previous.date.getTime() + 86_400_000) : null;
  const periodEnd = claim ? dayEnd(claim.date) : new Date();
  const inPeriod = (d: Date) => (!periodStart || d >= periodStart) && d <= periodEnd;

  const events = await prisma.timelineEvent.findMany({ where: { projectId }, orderBy: { seq: "asc" } });
  const generatedAt = new Date();
  const pdf = await PdfKit.create(`CIPAA pack: ${project.name}`, `${project.name}  ·  CIPAA pack generated ${formatDateTime(generatedAt)}`);

  // 1. Cover
  letterhead(pdf);
  pdf.text("CIPAA PAYMENT CLAIM EVIDENCE PACK", { size: 18, bold: true, gap: 8 });
  pdf.pair("Project", project.name);
  pdf.pair("Contract reference", project.contractRef ?? "Not recorded");
  pdf.pair("Claimant", `${COMPANY.name} (CIDB ${COMPANY.cidbGrade}, reg. no. ${COMPANY.cidbRegNo})`);
  pdf.pair("Respondent", project.clientName ?? "Not recorded");
  if (claim) {
    pdf.pair("Payment claim", `Progress Claim ${claim.number}, dated ${formatDate(claim.date)}`);
    pdf.pair("Amount claimed", rm(claim.amountClaimed));
    pdf.pair("Net after retention", rm(claim.netClaim));
  } else pdf.pair("Payment claim", "No progress claim has been issued yet.");
  pdf.pair("Period covered", `${periodStart ? formatDate(periodStart) : "Start of project"} to ${formatDate(periodEnd)}`);
  pdf.pair("Prepared", `${formatDateTime(generatedAt)} (Malaysia time) by ${preparedBy}`);
  pdf.pair("Timeline entries", String(events.length));

  // 2. Contract summary
  const approved = project.changeOrders.filter((c) => c.status === "APPROVED");
  const approvedTotal = sum(approved.map((c) => c.amount));
  pdf.heading("2. Contract summary");
  pdf.pair("Original contract sum", rm(project.contractValue));
  pdf.pair("Approved variations", `${rm(approvedTotal)} (${approved.length} ${approved.length === 1 ? "order" : "orders"})`);
  pdf.pair("Revised contract sum", rm(dec(project.contractValue).plus(approvedTotal)));

  // 3. Claim history
  pdf.heading("3. Payment claim history");
  if (project.claims.length === 0) pdf.text("No claims issued.");
  else {
    const w = [34, 72, 90, 90, 80, 80, 51];
    pdf.columns(["No.", "Date", "Work done", "Amount claimed", "Net claim", "Paid", "Status"], w, { bold: true, size: 8 });
    for (const c of project.claims) {
      const paid = sum(c.payments.map((p) => p.amount));
      const status = paid.greaterThanOrEqualTo(c.netClaim) ? "Paid" : paid.greaterThan(0) ? "Part paid" : "Unpaid";
      pdf.columns([String(c.number), formatDate(c.date), rm(c.workDone), rm(c.amountClaimed), rm(c.netClaim), rm(paid), status], w, { size: 8 });
    }
  }

  // 4. Evidence of work done: photos by location, then date
  const photos = project.photos.filter((p) => p.kind !== "FLOORPLAN" && p.kind !== "SELECTION" && inPeriod(p.capturedAt ?? p.takenAt));
  pdf.newPage();
  pdf.heading("4. Evidence of work done");
  pdf.text("Photographs taken in the period, grouped by location and then by date. Each shows the time on the phone, the GPS position where one was recorded, and a SHA-256 fingerprint of the original file.", { size: 9, gap: 6 });
  if (photos.length === 0) pdf.text("No photographs in this period.");
  const byLocation = new Map<string, typeof photos>();
  for (const p of photos) byLocation.set(p.location?.trim() || "Location not noted", [...(byLocation.get(p.location?.trim() || "Location not noted") ?? []), p]);
  let embedded = 0;
  for (const [location, group] of Array.from(byLocation.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    pdf.ensure(60);
    pdf.text(location, { size: 11, bold: true, gap: 4 });
    for (const p of group.sort((a, b) => (a.capturedAt ?? a.takenAt).getTime() - (b.capturedAt ?? b.takenAt).getTime())) {
      pdf.ensure(210);
      const at = p.capturedAt ?? p.takenAt;
      pdf.text(`${formatDateTime(at)}${p.capturedAt ? "" : " (server time; no device time)"}`, { size: 9, bold: true, gap: 0 });
      const tags = [p.phase, p.trade, p.caption].filter(Boolean).join(" · ");
      if (tags) pdf.text(tags, { size: 9, gap: 0 });
      pdf.text(p.latitude !== null && p.longitude !== null ? `GPS ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}${p.accuracy ? ` (±${Math.round(p.accuracy)} m)` : ""}` : "No GPS recorded", { size: 8, color: [0.4, 0.4, 0.45], gap: 0 });
      pdf.text(`Uploaded ${formatDateTime(p.createdAt)}  ·  SHA-256 ${p.sha256 ?? "n/a"}`, { size: 6.5, mono: true, color: [0.4, 0.4, 0.45], gap: 2 });
      if (embedded >= MAX_EMBEDDED_PHOTOS) pdf.text("(Image not embedded: pack limit. Included in the Evidence Package ZIP.)", { size: 8, gap: 6 });
      else {
        try {
          const ok = await pdf.image(await readPhotoFile(p), p.mimeType, 280, 190);
          if (ok) embedded += 1;
          else pdf.text(`(${p.mimeType} image not embedded; in the Evidence Package ZIP.)`, { size: 8, gap: 6 });
        } catch {
          pdf.text("(Image file could not be read.)", { size: 8, gap: 6 });
        }
        pdf.space(6);
      }
    }
  }

  // 5. Site diary extracts
  const diaries = project.siteDiaries.filter((d) => inPeriod(d.date));
  pdf.newPage();
  pdf.heading("5. Site diary extracts");
  if (diaries.length === 0) pdf.text("No site diaries in this period.");
  for (const d of diaries) {
    pdf.ensure(80);
    const men = Object.values(JSON.parse(d.manpower) as Record<string, number>).reduce((t, n) => t + n, 0);
    pdf.text(`${formatDate(d.date)}  ·  ${d.weather}  ·  ${men} workers`, { size: 10, bold: true, gap: 0 });
    pdf.text(d.worksDone, { size: 9, indent: 8, gap: 0 });
    if (d.issues) pdf.text(`Issues: ${d.issues}`, { size: 9, indent: 8, gap: 0 });
    pdf.text(`Prepared by ${d.preparedBy}${d.verifiedBy ? `; countersigned by ${d.verifiedBy}` : "; not countersigned"}. Fingerprint ${d.contentHash}`, { size: 6.5, mono: true, color: [0.4, 0.4, 0.45], indent: 8, gap: 6 });
  }

  // 6. Variation orders
  pdf.heading("6. Variation orders");
  if (approved.length === 0) pdf.text("No approved variation orders.");
  for (const c of approved) {
    pdf.ensure(50);
    pdf.text(`${formatDate(c.date)}  ·  ${rm(c.amount)}  ·  ${c.description}`, { size: 10, bold: true, gap: 0 });
    if (c.clientDecision === "APPROVED" && c.clientDecidedAt) {
      const who = c.clientDecidedById ? await prisma.clientUser.findUnique({ where: { id: c.clientDecidedById } }) : null;
      pdf.text(`Approved by the client${who ? ` (${who.name ?? who.email})` : ""} through their signed-in portal account on ${formatDateTime(c.clientDecidedAt)}.`, { size: 9, indent: 8, gap: 4 });
    } else {
      pdf.text(`Approved by the contractor${c.approvedAt ? ` on ${formatDateTime(c.approvedAt)}` : ""}. No client approval is recorded in the system.`, { size: 9, indent: 8, gap: 4 });
    }
  }

  // 7. Correspondence
  const notes = events.filter((e) => (e.eventType === "NOTE" || e.eventType === "MESSAGE" || e.eventType === "APPROVAL") && inPeriod(e.capturedAt));
  pdf.heading("7. Correspondence and notes");
  if (notes.length === 0) pdf.text("No notes or messages in this period.");
  for (const e of notes) {
    pdf.ensure(36);
    pdf.text(`${formatDateTime(e.capturedAt)}  ·  ${e.actorName ?? e.actorRole}`, { size: 8, color: [0.4, 0.4, 0.45], gap: 0 });
    pdf.text(e.title, { size: 9, bold: true, gap: 0 });
    if (e.description) pdf.text(e.description, { size: 9, indent: 8, gap: 4 });
  }

  // 8. Verification
  const check = verificationSection(pdf, events);
  return { bytes: await pdf.finish(), project, claim, check, count: events.length, photoCount: photos.length, diaryCount: diaries.length };
}
