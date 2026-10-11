import { BEFORE_COVER_ITEMS, PHOTO_PHASES, PHOTO_TRADES } from "./constants";

export type PhotoMetadata = {
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  trade: string | null;
  phase: string | null;
  location: string | null;
  checklistItem: string | null;
};

const MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000; // an offline photo may wait a long time to sync, but not years
const MAX_FUTURE_MS = 10 * 60 * 1000; // a little clock drift is normal; a capture "tomorrow" is not

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const num = (form: FormData, name: string) => {
  const raw = text(form, name);
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

/**
 * Read the evidence fields sent with an upload. The device clock and GPS are the phone's own claim,
 * so they are range-checked and kept apart from the server's own arrival time (Photo.createdAt).
 * Unknown tags are refused rather than silently dropped, because a mistyped tag hides a photo.
 */
export function parsePhotoMetadata(form: FormData, now = new Date()): { ok: true; data: PhotoMetadata } | { ok: false; error: string } {
  const trade = text(form, "trade") || null;
  if (trade && !(PHOTO_TRADES as readonly string[]).includes(trade)) return { ok: false, error: "Unknown trade." };
  const phase = text(form, "phase") || null;
  if (phase && !(PHOTO_PHASES as readonly string[]).includes(phase)) return { ok: false, error: "Unknown phase." };
  const checklistItem = text(form, "checklistItem") || null;
  if (checklistItem && !BEFORE_COVER_ITEMS.some((item) => item.key === checklistItem)) return { ok: false, error: "Unknown checklist item." };

  let capturedAt: Date | null = null;
  const rawCaptured = text(form, "capturedAt");
  if (rawCaptured) {
    const when = new Date(rawCaptured);
    const age = now.getTime() - when.getTime();
    if (!Number.isNaN(when.getTime()) && age <= MAX_AGE_MS && age >= -MAX_FUTURE_MS) capturedAt = when;
  }

  let latitude = num(form, "latitude");
  let longitude = num(form, "longitude");
  if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    latitude = null;
    longitude = null;
  }
  let accuracy = num(form, "accuracy");
  if (latitude === null || accuracy === null || accuracy < 0 || accuracy > 1_000_000) accuracy = null;

  return {
    ok: true,
    data: { capturedAt, latitude, longitude, accuracy, trade, phase, location: text(form, "location").slice(0, 200) || null, checklistItem },
  };
}
