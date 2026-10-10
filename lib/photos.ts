import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const PHOTO_KINDS = ["PROGRESS", "FLOORPLAN", "TASK"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** Uploads are kept on the server's disk, outside /public, and only ever served through an authenticated route. */
const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads", "photos");

// Photo ids are cuids; refuse anything else so an id can never walk out of the upload directory.
const safeId = (id: string) => {
  if (!/^[a-z0-9]{8,40}$/i.test(id)) throw new Error("Bad photo id");
  return id;
};

/**
 * Identify the image from its first bytes instead of trusting the file name or the browser's
 * Content-Type. SVG is deliberately not allowed: it can carry scripts.
 */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function savePhotoFile(id: string, bytes: Uint8Array) {
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), safeId(id)), bytes);
}

export const readPhotoFile = (id: string) => readFile(path.join(uploadDir(), safeId(id)));

export const deletePhotoFile = (id: string) => rm(path.join(uploadDir(), safeId(id)), { force: true });
