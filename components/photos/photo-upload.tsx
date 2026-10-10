"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
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
  onUploaded,
}: {
  kind: "PROGRESS" | "FLOORPLAN" | "TASK";
  projectId?: string;
  taskId?: string;
  label?: string;
  withCaption?: boolean;
  onUploaded?: (photoId: string) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", await shrink(file), file.name);
      body.set("kind", kind);
      body.set("caption", caption);
      if (projectId) body.set("projectId", projectId);
      if (taskId) body.set("taskId", taskId);
      const response = await fetch("/api/photos", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !result.id) {
        toast.error(result.error ?? "Upload failed. Please try again.");
        return;
      }
      toast.success("Photo uploaded");
      setFile(null);
      setCaption("");
      if (input.current) input.current.value = "";
      onUploaded?.(result.id);
      router.refresh();
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
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
