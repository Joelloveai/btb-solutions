"use client";

import { Camera, Check } from "lucide-react";
import { useRef, useState } from "react";
import { shrink } from "@/components/photos/shrink";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { Button } from "@/components/ui/button";
import { toStoredFile } from "@/lib/offline/files";

/** Subcontractor: attach an optional photo and mark the task done. Works with no signal: it is saved and sent later. */
export function TaskDoneForm({ taskId, taskLabel }: { taskId: string; taskLabel: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const { pending, submit } = useOfflineSubmit("Marked as done. Thank you!", () => setFile(null));
  const busy = pending || preparing;

  const finish = async () => {
    setPreparing(true);
    try {
      const stored = file ? await toStoredFile(await shrink(file), file.name) : undefined;
      submit({
        type: "completeTask",
        label: `Done: ${taskLabel}${stored ? " (with photo)" : ""}`,
        payload: { taskId },
        file: stored,
        fields: stored ? { kind: "TASK", taskId, capturedAt: new Date(file?.lastModified || Date.now()).toISOString() } : undefined,
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 print:hidden">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={`Photo for ${taskLabel}`}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="secondary" className="h-12 w-full" onClick={() => input.current?.click()} disabled={busy}>
        <Camera className="h-5 w-5" aria-hidden="true" />
        {file ? "Change photo" : "Take or add a photo"}
      </Button>
      {file ? <p className="truncate text-sm text-muted-foreground">{file.name}</p> : null}
      <Button type="button" className="h-12 w-full text-base" onClick={finish} disabled={busy}>
        <Check className="h-5 w-5" aria-hidden="true" />
        {busy ? "Saving…" : "Mark as done"}
      </Button>
    </div>
  );
}
