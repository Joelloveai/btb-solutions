import JSZip from "jszip";
import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { readPhotoFile } from "@/lib/photos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
// A big evidence package takes a while to read and zip.
export const maxDuration = 120;

const MAX_PHOTOS = 600;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** File and folder names: keep letters, digits and common punctuation; drop anything a file system dislikes. */
const safe = (value: string) => value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "unnamed";
const csv = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  const defused = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; // spreadsheets run text that starts with = + - @
  return `"${defused.replace(/"/g, '""')}"`;
};
const stamp = (d: Date) => d.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");

/**
 * "Evidence package": every photo of a project in one ZIP, filed by phase and trade, with a
 * spreadsheet of when (device clock) and where (GPS) each was taken, when it reached the server,
 * and a SHA-256 of each file, so the package can show that nothing was altered after upload.
 * Staff only.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id }, include: { photos: { orderBy: { createdAt: "asc" } } } });
  if (!project) return new Response("Not found", { status: 404 });
  if (project.photos.length > MAX_PHOTOS) {
    return new Response(`This project has ${project.photos.length} photos; packages are limited to ${MAX_PHOTOS}. Download by phase from the photo list instead.`, { status: 413 });
  }

  const uploaders = new Map((await prisma.user.findMany({ select: { id: true, email: true } })).map((u) => [u.id, u.email]));
  const zip = new JSZip();
  const rows = [["file", "photo_id", "type", "phase", "trade", "location", "caption", "before_cover_item", "taken_on_device", "uploaded_to_server", "latitude", "longitude", "gps_accuracy_m", "sha256", "uploaded_by"]];
  const missing: string[] = [];

  for (const photo of project.photos) {
    const taken = photo.capturedAt ?? photo.takenAt;
    const folder =
      photo.kind === "FLOORPLAN" ? "floor-plans" : photo.kind === "TASK" ? `task-photos/${safe(photo.trade ?? "No trade")}` : photo.kind === "PUNCH" ? `punch-photos/${safe(photo.trade ?? "No trade")}` : photo.kind === "SELECTION" ? "selections" : `photos/${safe(photo.phase ?? "No phase")}/${safe(photo.trade ?? "No trade")}`;
    const file = `${folder}/${stamp(taken)}_${photo.id}.${EXT[photo.mimeType] ?? "bin"}`;
    try {
      zip.file(file, await readPhotoFile(photo), { binary: true });
    } catch {
      missing.push(photo.id);
      continue;
    }
    rows.push([
      file,
      photo.id,
      photo.kind,
      photo.phase ?? "",
      photo.trade ?? "",
      photo.location ?? "",
      photo.caption ?? "",
      photo.checklistItem ?? "",
      photo.capturedAt ? photo.capturedAt.toISOString() : `${photo.takenAt.toISOString()} (server time; no device time recorded)`,
      photo.createdAt.toISOString(),
      photo.latitude ?? "",
      photo.longitude ?? "",
      photo.accuracy ?? "",
      photo.sha256 ?? "",
      (photo.uploadedById && uploaders.get(photo.uploadedById)) || "",
    ].map(String));
  }

  zip.file("index.csv", "﻿" + rows.map((r) => r.map(csv).join(",")).join("\r\n") + "\r\n");
  zip.file(
    "README.txt",
    [
      `Evidence package: ${project.name}`,
      `Prepared ${formatDateTime(new Date())} (Malaysia time)`,
      "",
      "Photos are filed by phase, then trade. index.csv lists every photo with:",
      "  taken_on_device      the phone's own clock when the photo was taken (a claim by the device)",
      "  uploaded_to_server   when the photo reached this system (the server's clock)",
      "  latitude/longitude   the phone's GPS position, if the person allowed location access",
      "  sha256               a fingerprint of the file as stored; recompute it to confirm the file is unchanged",
      "",
      `Photos in package: ${rows.length - 1}`,
      ...(missing.length ? [`Photos whose file could not be read and are NOT included: ${missing.join(", ")}`] : []),
    ].join("\r\n"),
  );

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" }); // JPEGs are already compressed
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safe(project.name).slice(0, 60)}-evidence-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
