"use client";

import { Camera, MapPin, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { captureSummary } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
import { PHOTO_PHASES, PHOTO_TRADES } from "@/lib/constants";
import { captureLocation, type Geo } from "@/lib/offline/geo";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { toStoredFile } from "@/lib/offline/files";
import { shrink } from "./shrink";

/**
 * Add a photo. On a phone the picker offers the camera (the file input uses the device's own
 * camera; no extra permissions or libraries). `onUploaded` receives the new photo id.
 */
const remembered = (key: string) => {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: just do not remember */
  }
};

export type PhotoDefaults = { trade?: string; phase?: string; location?: string; checklistItem?: string };

/**
 * Add a photo with its evidence: when it was taken (the phone's clock), where (GPS, if allowed), and
 * which trade and phase it belongs to. Trade and phase remember your last choice so a run of photos
 * on one job needs no extra taps. Works with no signal: the photo is saved on the phone and sent later.
 */
export function PhotoUpload({
  kind,
  projectId,
  taskId,
  label = "Add photo",
  withCaption = true,
  defaults,
  onDone,
  autoOpen = false,
}: {
  kind: "PROGRESS" | "FLOORPLAN" | "TASK";
  projectId?: string;
  taskId?: string;
  label?: string;
  withCaption?: boolean;
  /** Pre-filled tags, e.g. from a "before cover" checklist item. */
  defaults?: PhotoDefaults;
  onDone?: () => void;
  /** Open the camera as soon as this appears (it was reached by tapping a capture button). */
  autoOpen?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const geoRequest = useRef<Promise<Geo | null> | null>(null);
  const tagged = kind === "PROGRESS";
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [trade, setTrade] = useState(defaults?.trade ?? "");
  const [phase, setPhase] = useState(defaults?.phase ?? "");
  const [location, setLocation] = useState(defaults?.location ?? "");
  const [geo, setGeo] = useState<Geo | null | undefined>(undefined);
  const [preparing, setPreparing] = useState(false);

  // First use on this phone: start from the last trade and phase chosen.
  useEffect(() => {
    if (!tagged) return;
    if (!defaults?.trade) setTrade(remembered("btb-photo-trade"));
    if (!defaults?.phase) setPhase(remembered("btb-photo-phase"));
  }, [tagged, defaults?.trade, defaults?.phase]);

  useEffect(() => {
    if (autoOpen) {
      geoRequest.current = captureLocation().then((g) => (setGeo(g), g));
      input.current?.click();
    }
    // Only once, when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setFile(null);
    setCaption("");
    setGeo(undefined);
    geoRequest.current = null;
    if (input.current) input.current.value = "";
    onDone?.();
  };
  const { pending, submit } = useOfflineSubmit(async () => {
    if (!projectId) return "Photo added.";
    const result = await captureSummary("photo", projectId);
    return result.ok ? result.data!.message : "Photo added.";
  }, reset);
  const busy = pending || preparing;

  const choose = () => {
    // Ask for the location at the moment of the tap (the person is at the spot), while the chooser opens.
    geoRequest.current = captureLocation().then((g) => (setGeo(g), g));
    input.current?.click();
  };

  const upload = async () => {
    if (!file) return;
    setPreparing(true);
    try {
      const position = (await geoRequest.current) ?? geo ?? null;
      if (tagged) {
        remember("btb-photo-trade", trade);
        remember("btb-photo-phase", phase);
      }
      const stored = await toStoredFile(await shrink(file), file.name);
      // A nudge, never a block: the photo is saved either way.
      if (!position) toast.message("Add location to strengthen this as evidence.", { description: "Allow location access in your browser settings." });
      submit({
        type: "uploadPhoto",
        label: `Photo${caption ? `: ${caption}` : ""}`,
        projectId,
        payload: {},
        file: stored,
        fields: {
          kind,
          caption,
          ...(projectId ? { projectId } : {}),
          ...(taskId ? { taskId } : {}),
          // When the photo was taken on this device, not when it reaches the server.
          capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
          ...(position ? { latitude: String(position.latitude), longitude: String(position.longitude), accuracy: String(Math.round(position.accuracy)) } : {}),
          ...(tagged && trade ? { trade } : {}),
          ...(tagged && phase ? { phase } : {}),
          ...(tagged && location ? { location } : {}),
          ...(defaults?.checklistItem ? { checklistItem: defaults.checklistItem } : {}),
        },
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3 shadow-sm print:hidden">
      <input
        ref={input}
        type="file"
        accept="image/*"
        // On phones this input offers the camera as well as the photo library.
        capture={kind === "FLOORPLAN" ? undefined : "environment"}
        className="sr-only"
        aria-label={label}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="secondary" onClick={choose} disabled={busy}>
        <Camera className="h-4 w-4" aria-hidden="true" />
        {file ? "Choose another" : label}
      </Button>
      {file ? (
        <>
          <p className="truncate text-sm text-muted-foreground">{file.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="geo-status">
            {geo ? <MapPin className="h-3.5 w-3.5 text-profit" aria-hidden="true" /> : <MapPinOff className="h-3.5 w-3.5" aria-hidden="true" />}
            {geo === undefined ? "Finding location…" : geo ? `Location captured (±${Math.round(geo.accuracy)} m)` : "No location (allow location access to record where this was taken)"}
          </p>
          {tagged ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Trade">
                  <Select value={trade} onChange={(event) => setTrade(event.target.value)}>
                    <option value="">Choose…</option>
                    {PHOTO_TRADES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Phase">
                  <Select value={phase} onChange={(event) => setPhase(event.target.value)}>
                    <option value="">Choose…</option>
                    {PHOTO_PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {!trade || !phase ? <p className="text-xs text-pending-dark">Add a trade and phase so this photo can be found if there is ever a dispute.</p> : null}
              <Field label="Location (optional)">
                <Input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} placeholder="e.g. Level 3, Unit 12, Master Bath" />
              </Field>
            </>
          ) : null}
          {withCaption ? (
            <Field label="Caption (optional)">
              <VoiceInput value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={200} placeholder="e.g. Kitchen tiling finished" />
            </Field>
          ) : null}
          <Button type="button" onClick={upload} disabled={busy} className="w-full">
            {busy ? "Saving…" : "Save photo"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
