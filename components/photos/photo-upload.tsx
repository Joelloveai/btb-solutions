"use client";

import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { toStoredFile } from "@/lib/offline/files";
import { shrink } from "./shrink";

/**
 * Add a photo. On a phone the picker offers the camera (the file input uses the device's own
 * camera; no extra permissions or libraries). `onUploaded` receives the new photo id.
 */
export function PhotoUpload({
  kind,
  projectId,
  taskId,
  label = "Add photo",
  withCaption = true,
}: {
  kind: "PROGRESS" | "FLOORPLAN" | "TASK";
  projectId?: string;
  taskId?: string;
  label?: string;
  withCaption?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [preparing, setPreparing] = useState(false);
  const reset = () => {
    setFile(null);
    setCaption("");
    if (input.current) input.current.value = "";
  };
  const { pending, submit } = useOfflineSubmit("Photo uploaded", reset);
  const busy = pending || preparing;

  const upload = async () => {
    if (!file) return;
    setPreparing(true);
    try {
      const stored = await toStoredFile(await shrink(file), file.name);
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
      <Button type="button" variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
        <Camera className="h-4 w-4" aria-hidden="true" />
        {file ? "Choose another" : label}
      </Button>
      {file ? (
        <>
          <p className="truncate text-sm text-muted-foreground">{file.name}</p>
          {withCaption ? (
            <Field label="Caption (optional)">
              <Input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={200} placeholder="e.g. Kitchen tiling finished" />
            </Field>
          ) : null}
          <Button type="button" onClick={upload} disabled={busy} className="w-full">
            {busy ? "Uploading…" : "Upload photo"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
