import type { StoredFile } from "./db";

const EDGE = 320;

/** Fetch an (authenticated) photo and shrink it to a small JPEG that is cheap to keep on the device. */
export async function thumbnailFromUrl(url: string): Promise<StoredFile | null> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.7));
    return blob ? { bytes: await blob.arrayBuffer(), type: "image/jpeg", name: "thumb.jpg" } : null;
  } catch {
    return null;
  }
}
