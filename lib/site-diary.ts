import { createHash, randomBytes } from "node:crypto";
import { COMPANY } from "@/lib/company-config";
import { formatDate, formatDateTime } from "@/lib/format";
import { PdfKit } from "@/lib/pdf-kit";

const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

/** Decode a drawn signature (PNG data URL). Returns null if it is not a small, real PNG. */
export function decodeSignature(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const bytes = new Uint8Array(Buffer.from(match[1]!, "base64"));
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 200 || bytes.length > 300_000 || !magic.every((b, i) => bytes[i] === b)) return null;
  return bytes;
}

export type DiaryContent = {
  projectId: string;
  date: string; // yyyy-mm-dd
  weather: string;
  manpower: Record<string, number>;
  machinery: string[];
  materialsIn: { description: string; vendor: string | null }[];
  worksDone: string;
  issues: string | null;
  visitorLog: string | null;
  safetyObservations?: string | null;
  weatherNote?: string | null;
  preparedById: string;
  preparedAtIso: string;
};

const sortedEntries = (o: Record<string, number>) => Object.entries(o).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b));

/** What both signatures are bound to: change anything in the diary and this changes. */
export function diaryContentHash(c: DiaryContent) {
  return sha(
    JSON.stringify([c.projectId, c.date, c.weather, sortedEntries(c.manpower), [...c.machinery].sort(), c.materialsIn, c.worksDone, c.issues, c.visitorLog, ...(c.safetyObservations ? [c.safetyObservations] : []), c.preparedById, c.preparedAtIso]),
  );
}

/** A signature's fingerprint ties the drawn image to the diary content, the signer and the moment. */
export function signatureHash(contentHash: string, signerId: string, signedAtIso: string, png: Uint8Array) {
  return sha(JSON.stringify([contentHash, signerId, signedAtIso, sha(png)]));
}

export const newPdfKey = (projectId: string) => `projects/${projectId}/diaries/${randomBytes(12).toString("hex")}.pdf`;
/** Local storage is addressed by the 24-hex id inside the key. */
export const pdfIdFromKey = (key: string) => key.split("/").pop()!.replace(/\.pdf$/, "");

export type DiaryForPdf = DiaryContent & {
  projectName: string;
  preparedBy: string;
  preparedSignature: Uint8Array;
  preparedSignatureHash: string;
  contentHash: string;
  verified: { by: string; atIso: string; signature: Uint8Array; hash: string } | null;
};

export async function buildDiaryPdf(d: DiaryForPdf): Promise<Uint8Array> {
  const pdf = await PdfKit.create(`Site diary ${d.date}`, `${d.projectName}  ·  Site diary ${d.date}  ·  ${d.verified ? "Countersigned" : "Awaiting countersignature"}`);
  pdf.text(COMPANY.name, { size: 16, bold: true, gap: 0 });
  pdf.text(`CIDB ${COMPANY.cidbGrade}  ·  Reg. no. ${COMPANY.cidbRegNo}`, { size: 9, color: [0.35, 0.35, 0.4], gap: 0 });
  for (const line of COMPANY.addressLines) pdf.text(line, { size: 9, color: [0.35, 0.35, 0.4], gap: 0 });
  pdf.space(8);
  pdf.text("BUKU HARIAN TAPAK BINA / SITE DIARY", { size: 16, bold: true, gap: 6 });
  pdf.pair("Project", d.projectName);
  pdf.pair("Date", formatDate(new Date(`${d.date}T00:00:00.000Z`)));
  pdf.pair("Weather", d.weatherNote ? `${d.weather} (${d.weatherNote})` : d.weather);

  pdf.heading("Manpower on site", 12);
  const men = sortedEntries(d.manpower);
  if (men.length === 0) pdf.text("None recorded.");
  for (const [trade, n] of men) pdf.pair(trade, String(n), 200);
  if (men.length > 0) pdf.pair("Total", String(men.reduce((t, [, n]) => t + n, 0)), 200);

  pdf.heading("Machinery on site", 12);
  pdf.text(d.machinery.length ? d.machinery.join(", ") : "None recorded.");

  pdf.heading("Materials delivered", 12);
  if (d.materialsIn.length === 0) pdf.text("None recorded.");
  for (const m of d.materialsIn) pdf.text(`• ${m.description}${m.vendor ? ` (${m.vendor})` : ""}`, { gap: 0 });

  pdf.heading("Works done", 12);
  pdf.text(d.worksDone);
  pdf.heading("Issues / instructions", 12);
  pdf.text(d.issues || "None recorded.");
  pdf.heading("Safety observations", 12);
  pdf.text(d.safetyObservations || "None recorded.");
  pdf.heading("Visitors", 12);
  pdf.text(d.visitorLog || "None recorded.");

  pdf.ensure(190);
  pdf.heading("Signatures", 12);
  pdf.text(`Prepared by ${d.preparedBy} on ${formatDateTime(new Date(d.preparedAtIso))}`, { size: 9, bold: true, gap: 2 });
  await pdf.image(d.preparedSignature, "image/png", 180, 60);
  pdf.text(`Signature fingerprint ${d.preparedSignatureHash}`, { size: 6.5, mono: true, color: [0.4, 0.4, 0.45], gap: 8 });
  if (d.verified) {
    pdf.text(`Countersigned by ${d.verified.by} on ${formatDateTime(new Date(d.verified.atIso))}`, { size: 9, bold: true, gap: 2 });
    await pdf.image(d.verified.signature, "image/png", 180, 60);
    pdf.text(`Signature fingerprint ${d.verified.hash}`, { size: 6.5, mono: true, color: [0.4, 0.4, 0.45], gap: 8 });
  } else {
    pdf.text("Awaiting countersignature by the contractor's representative.", { size: 9, gap: 8 });
  }
  pdf.text(`Diary content fingerprint ${d.contentHash}`, { size: 6.5, mono: true, color: [0.4, 0.4, 0.45] });
  return pdf.finish();
}
