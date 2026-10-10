"use client";

import { Camera, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { completeTask } from "@/app/actions";
import { shrink } from "@/components/photos/shrink";
import { Button } from "@/components/ui/button";

/** Subcontractor: attach an optional photo and mark the task done. Big, thumb-sized controls. */
export function TaskDoneForm({ taskId, taskLabel }: { taskId: string; taskLabel: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    setBusy(true);
    try {
      let photoId: string | undefined;
      if (file) {
        const body = new FormData();
        body.set("file", await shrink(file), file.name);
        body.set("kind", "TASK");
        body.set("taskId", taskId);
        const response = await fetch("/api/photos", { method: "POST", body });
        const result = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
        if (!response.ok || !result.id) {
          toast.error(result.error ?? "Photo upload failed. Please try again.");
          return;
        }
        photoId = result.id;
      }
      const done = await completeTask(taskId, photoId);
      if (done.ok) {
        toast.success("Marked as done. Thank you!");
        router.refresh();
      } else {
        toast.error(done.error);
      }
    } finally {
      setBusy(false);
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
