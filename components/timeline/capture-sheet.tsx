"use client";

import { Camera, Plus, Receipt, StickyNote, type LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { CostFormBody } from "@/components/forms/add-cost-form";
import { PhotoUpload } from "@/components/photos/photo-upload";
import type { Lookups } from "@/components/projects/lookups";
import { Modal } from "@/components/ui/modal";
import { NoteForm } from "./note-form";

type Mode = "menu" | "photo" | "note" | "cost";

const CHOICES: { mode: Exclude<Mode, "menu">; label: string; Icon: LucideIcon }[] = [
  { mode: "photo", label: "Photo", Icon: Camera },
  { mode: "note", label: "Note", Icon: StickyNote },
  { mode: "cost", label: "Cost", Icon: Receipt },
];

const TITLES: Record<Mode, string> = { menu: "Add to timeline", photo: "Add photo", note: "Add note", cost: "Add cost" };

/** The "+" button at the bottom-right: one tap to add anything to this project's timeline. */
export function AddToTimeline({ projectId, lookups }: { projectId: string; lookups: Lookups }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const close = useCallback(() => setMode(null), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setMode("menu")}
        aria-label="Add to timeline"
        className="fixed bottom-20 right-4 z-40 flex h-14 items-center gap-1 rounded-full bg-accent px-5 text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:bottom-6"
      >
        <Camera className="h-6 w-6" aria-hidden="true" />
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
      <Modal open={mode !== null} onClose={close} title={mode ? TITLES[mode] : TITLES.menu}>
        {mode === "menu" ? (
          <div className="grid gap-2">
            {CHOICES.map(({ mode: m, label, Icon }) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex h-14 items-center gap-3 rounded-xl border bg-card px-4 text-base font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {mode === "photo" ? <PhotoUpload kind="PROGRESS" projectId={projectId} label="Take photo" autoOpen onDone={close} /> : null}
        {mode === "note" ? <NoteForm projectId={projectId} close={close} /> : null}
        {mode === "cost" ? <CostFormBody projectId={projectId} lookups={lookups} close={close} /> : null}
      </Modal>
    </>
  );
}
