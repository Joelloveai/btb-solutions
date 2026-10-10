import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { deleteFromR2, downloadFromR2, isR2Configured, uploadToR2 } from "./r2-storage";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const PHOTO_KINDS = ["PROGRESS", "FLOORPLAN", "TASK"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** Local-disk fallback (no R2 credentials): outside /public, and only ever served through an authenticated route. */
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

/** What storage needs to know about a photo. All of it is already in the Photo table, so no extra column is needed. */
export type StoredPhoto = { id: string; projectId: string; mimeType: string };

const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Where a photo lives in R2: derived from the photo's own project, id and type, e.g. projects/<projectId>/<photoId>.jpg */
export const photoKey = (photo: StoredPhoto) => `projects/${photo.projectId}/${photo.id}.${EXTENSIONS[photo.mimeType] ?? "bin"}`;

const saveLocal = async (id: string, bytes: Uint8Array) => {
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), safeId(id)), bytes);
};
const readLocal = (id: string) => readFile(path.join(uploadDir(), safeId(id)));
const deleteLocal = (id: string) => rm(path.join(uploadDir(), safeId(id)), { force: true });

/** Local-disk access for the one-off migration to R2 (scripts/migrate-photos-to-r2.ts). */
export const readLocalPhotoFile = readLocal;
export const deleteLocalPhotoFile = deleteLocal;

/** Store a photo's bytes: in Cloudflare R2 when configured, otherwise on local disk. */
export async function savePhotoFile(photo: StoredPhoto, bytes: Uint8Array): Promise<void> {
  if (isR2Configured()) {
    await uploadToR2(bytes, photoKey(photo), photo.mimeType);
    return;
  }
  await saveLocal(photo.id, bytes);
}

/**
 * Read a photo's bytes. With R2 on, a photo that has not been moved there yet (see
 * scripts/migrate-photos-to-r2.ts) is still found on local disk, so switching storage never breaks old photos.
 */
export async function readPhotoFile(photo: StoredPhoto): Promise<Uint8Array> {
  if (isR2Configured()) {
    const bytes = await downloadFromR2(photoKey(photo));
    if (bytes) return bytes;
  }
  return readLocal(photo.id);
}

export async function deletePhotoFile(photo: StoredPhoto): Promise<void> {
  if (isR2Configured()) await deleteFromR2(photoKey(photo));
  await deleteLocal(photo.id); // also clears any local copy left from before the move
}
