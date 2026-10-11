"use client";

import { Camera, Check } from "lucide-react";
import { useRef, useState } from "react";
import { shrink } from "@/components/photos/shrink";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { Button } from "@/components/ui/button";
import { toStoredFile } from "@/lib/offline/files";
import { captureLocation, type Geo } from "@/lib/offline/geo";

/** Subcontractor: photograph the fix and mark the punch item done. Works with no signal. */
export function PunchDoneForm({ punchId, label, trade, location }: { punchId: string; label: string; trade: string; location: string }) {
  const input = useRef<HTMLInputElement>(null);
  const geoRequest = useRef<Promise<Geo | null> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const { pending, submit } = useOfflineSubmit("Marked as fixed. Thank you!", () => setFile(null));
  const busy = pending || preparing;

  const finish = async () => {
    setPreparing(true);
    try {
      const position = file ? await geoRequest.current : null;
      const stored = file ? await toStoredFile(await shrink(file), file.name) : undefined;
      submit({
        type: "resolvePunch",
        label: `Fixed: ${label}${stored ? " (with photo)" : ""}`,
        payload: { punchId },
        file: stored,
        fields: stored
          ? {
              kind: "PUNCH",
              punchId,
              trade,
              phase: "Punch List",
              location,
              capturedAt: new Date(file?.lastModified || Date.now()).toISOString(),
              ...(position ? { latitude: String(position.latitude), longitude: String(position.longitude), accuracy: String(Math.round(position.accuracy)) } : {}),
            }
          : undefined,
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 print:hidden">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-label={`Photo of the fix: ${label}`} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full"
        disabled={busy}
        onClick={() => {
          geoRequest.current = captureLocation();
          input.current?.click();
        }}
      >
        <Camera className="h-5 w-5" aria-hidden="true" />
        {file ? "Change photo" : "Photograph the fix"}
      </Button>
      {file ? <p className="truncate text-sm text-muted-foreground">{file.name}</p> : null}
      <Button type="button" className="h-12 w-full text-base" onClick={finish} disabled={busy}>
        <Check className="h-5 w-5" aria-hidden="true" />
        {busy ? "Saving…" : "Mark as fixed"}
      </Button>
    </div>
  );
}
