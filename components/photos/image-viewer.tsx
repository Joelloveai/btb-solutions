"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Click a thumbnail to open the photo large. "Full size" lets a floor plan be panned and inspected in detail. */
export function ImageViewer({ id, title, caption, children }: { id: string; title: string; caption?: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open photo: ${title}`}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="md:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{caption ?? "Use Full size to look at the detail."}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${id}`} alt={caption ?? title} className={full ? "max-w-none" : "mx-auto h-auto max-h-[62vh] w-auto max-w-full"} />
          </div>
          <Button variant="secondary" small onClick={() => setFull((v) => !v)} className="justify-self-start">
            {full ? "Fit to screen" : "Full size"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
