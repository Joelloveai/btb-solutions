"use client";

import { Camera, CircleCheck, Circle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BEFORE_COVER_ITEMS } from "@/lib/constants";
import { PhotoUpload } from "./photo-upload";

/**
 * "Before cover" checklist. Once rebar is poured over, sleeves are boarded in, or pipes are plastered,
 * nobody can look again. A dated, tagged photo taken BEFORE that is what settles a dispute later.
 */
export function BeforeCoverChecklist({ projectId, counts }: { projectId: string; counts: Record<string, number> }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const missing = BEFORE_COVER_ITEMS.filter((item) => !counts[item.key]).length;
  const active = BEFORE_COVER_ITEMS.find((item) => item.key === openKey);

  return (
    <Card className="p-3 sm:p-4" role="region" aria-label="Before cover checklist">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Before cover</h3>
          <p className="text-xs text-muted-foreground">Photograph these BEFORE they are covered up. This is the proof if there is ever a dispute.</p>
        </div>
        <p className={`text-xs font-semibold ${missing === 0 ? "text-profit" : "text-pending-dark"}`} data-testid="before-cover-status">
          {missing === 0 ? "All photographed" : `${BEFORE_COVER_ITEMS.length - missing} of ${BEFORE_COVER_ITEMS.length} photographed`}
        </p>
      </div>
      <ul className="mt-3 divide-y rounded-lg border">
        {BEFORE_COVER_ITEMS.map((item) => {
          const count = counts[item.key] ?? 0;
          return (
            <li key={item.key} className="flex items-center justify-between gap-2 px-3 py-2" data-testid={`checklist-${item.key}`}>
              <span className="flex min-w-0 items-center gap-2 text-sm">
                {count > 0 ? <CircleCheck className="h-5 w-5 shrink-0 text-profit" aria-label="Photographed" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="Not yet photographed" />}
                <span className="truncate">{item.label}</span>
                {count > 0 ? <span className="text-xs text-muted-foreground">({count})</span> : null}
              </span>
              <Button small variant={count > 0 ? "ghost" : "secondary"} onClick={() => setOpenKey(item.key)} aria-label={`Photograph: ${item.label}`}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                {count > 0 ? "Add another" : "Photograph"}
              </Button>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!active} onOpenChange={(open) => !open && setOpenKey(null)}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{active?.label}</DialogTitle>
            <DialogDescription>Filed as Pre-cover · {active?.trade}.</DialogDescription>
          </DialogHeader>
          {active ? (
            <PhotoUpload
              kind="PROGRESS"
              projectId={projectId}
              label={`Take photo: ${active.label}`}
              defaults={{ trade: active.trade, phase: "Pre-cover", checklistItem: active.key }}
              onDone={() => setOpenKey(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
