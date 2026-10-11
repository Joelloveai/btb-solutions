export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export type DocumentFileType = { mime: string; ext: string; /** safe for the browser to show in the page */ inline: boolean };

const startsWith = (bytes: Uint8Array, text: string) => text.split("").every((ch, i) => bytes[i] === ch.charCodeAt(0));

/**
 * Identify an uploaded document from its first bytes, so a file's name or claimed type cannot be used to
 * sneak something else in. Allowed: PDF, JPEG, PNG, WebP, DWG (AutoCAD), and Word/Excel (.docx/.xlsx).
 * Everything except PDFs and images is only ever offered as a download.
 */
export function detectDocumentType(bytes: Uint8Array, fileName: string): DocumentFileType | null {
  if (startsWith(bytes, "%PDF-")) return { mime: "application/pdf", ext: "pdf", inline: true };
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", ext: "jpg", inline: true };
  if (bytes.length > 8 && bytes[0] === 0x89 && startsWith(bytes.subarray(1), "PNG")) return { mime: "image/png", ext: "png", inline: true };
  if (bytes.length > 12 && startsWith(bytes, "RIFF") && startsWith(bytes.subarray(8), "WEBP")) return { mime: "image/webp", ext: "webp", inline: true };
  if (startsWith(bytes, "AC10")) return { mime: "application/acad", ext: "dwg", inline: false };
  // .docx and .xlsx are ZIP files: the signature alone cannot tell them from any other zip, so the name must agree too.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".docx")) return { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx", inline: false };
    if (lower.endsWith(".xlsx")) return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx", inline: false };
  }
  return null;
}

/** A name for finding other versions of the same document: case and stray spaces do not matter. */
export const documentNameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** A download name that is safe in a header and on a file system. */
export const safeDownloadName = (name: string, ext: string) => {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().slice(0, 100) || "document";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
};
