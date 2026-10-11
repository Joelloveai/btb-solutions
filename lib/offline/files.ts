import type { StoredFile } from "./db";

/** Turn a Blob/File into something IndexedDB stores reliably on every browser (including iOS Safari). */
export async function toStoredFile(blob: Blob, name: string): Promise<StoredFile> {
  return { bytes: await blob.arrayBuffer(), type: blob.type || "application/octet-stream", name };
}
