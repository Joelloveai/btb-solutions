"use client";

import { useState } from "react";
import { assignPunchItem, closePunchItem, deletePunchItem, reopenPunchItem } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { useSubmit } from "@/components/forms/use-submit";
import { ImageViewer } from "@/components/photos/image-viewer";
import type { Lookups } from "@/components/projects/lookups";
import { Badge } from "@/components/ui/badge";
import { Button, linkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { PUNCH_STATUS_LABELS, type PunchStatus } from "@/lib/constants";
import { AddPunchForm } from "./add-punch-form";

export type PunchRow = {
  id: string;
  location: string;
  description: string;
  trade: string;
  status: PunchStatus;
  subcontractorId: string | null;
  subcontractorName: string | null;
  dueText: string | null;
  overdue: boolean;
  photoId: string | null;
  resolvedPhotoId: string | null;
  resolvedText: string | null;
};

const tone = { OPEN: "yellow", DONE: "blue", CLOSED: "green" } as const;
const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "DONE", label: "To verify" },
  { key: "CLOSED", label: "Closed" },
] as const;

function Actions({ row }: { row: PunchRow }) {
  const close = useSubmit("Punch item closed", () => undefined);
  const reopen = useSubmit("Sent back to the subcontractor", () => undefined);
  return (
    <>
      {row.status === "DONE" ? (
        <Button small disabled={close.pending} onClick={() => close.submit(() => closePunchItem(row.id))}>
          Verify &amp; close
        </Button>
      ) : null}
      {row.status !== "OPEN" ? (
        <Button small variant="secondary" disabled={reopen.pending} onClick={() => reopen.submit(() => reopenPunchItem(row.id))}>
          Reopen
        </Button>
      ) : null}
    </>
  );
}

function Assign({ row, lookups }: { row: PunchRow; lookups: Lookups }) {
  const { submit } = useSubmit("Assigned", () => undefined);
  return (
    <Select
      aria-label={`Assign: ${row.description}`}
      value={row.subcontractorId ?? ""}
      onChange={(event) => submit(() => assignPunchItem(row.id, event.target.value))}
      className="max-w-[14rem]"
    >
      <option value="">Not assigned</option>
      {lookups.subcons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}

/** The contractor's punch list for one project. */
export function PunchPanel({ projectId, rows, lookups }: { projectId: string; rows: PunchRow[]; lookups: Lookups }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const shown = rows.filter((r) => filter === "ALL" || r.status === filter);
  const count = (key: string) => (key === "ALL" ? rows.length : rows.filter((r) => r.status === key).length);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter punch items">
          {FILTERS.map((f) => (
            <Button key={f.key} small variant={filter === f.key ? "primary" : "secondary"} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} ({count(f.key)})
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/projects/${projectId}/punch/print`} target="_blank" rel="noreferrer" className={linkButton("secondary", true)}>
            Print punch list
          </a>
          <AddPunchForm projectId={projectId} lookups={lookups} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No punch items" hint="Walk the job, photograph each defect, and assign it to the subcontractor who must fix it." action={<AddPunchForm projectId={projectId} lookups={lookups} />} />
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing in this view.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((row) => (
            <li key={row.id} className="rounded-xl border bg-card p-3 shadow-sm" data-testid="punch-row">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{row.location}</p>
                  <p className="text-sm">{row.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge tone="gray">{row.trade}</Badge>
                    {row.dueText ? <span className={row.overdue && row.status === "OPEN" ? "font-semibold text-loss" : ""}>due {row.dueText}</span> : null}
                    {row.resolvedText ? <span>fixed {row.resolvedText}</span> : null}
                  </p>
                </div>
                <Badge tone={tone[row.status]}>{PUNCH_STATUS_LABELS[row.status]}</Badge>
              </div>
              {row.photoId || row.resolvedPhotoId ? (
                <div className="mt-2 flex gap-3">
                  {row.photoId ? (
                    <figure className="w-24">
                      <ImageViewer id={row.photoId} title={`Defect: ${row.description}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/photos/${row.photoId}`} alt={`Defect: ${row.description}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      </ImageViewer>
                      <figcaption className="mt-1 text-center text-[11px] text-muted-foreground">Defect</figcaption>
                    </figure>
                  ) : null}
                  {row.resolvedPhotoId ? (
                    <figure className="w-24">
                      <ImageViewer id={row.resolvedPhotoId} title={`Fixed: ${row.description}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/photos/${row.resolvedPhotoId}`} alt={`Fixed: ${row.description}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      </ImageViewer>
                      <figcaption className="mt-1 text-center text-[11px] text-muted-foreground">Fixed</figcaption>
                    </figure>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 print:hidden">
                {row.status === "OPEN" ? <Assign row={row} lookups={lookups} /> : <span className="text-sm text-muted-foreground">{row.subcontractorName ?? "Not assigned"}</span>}
                <div className="flex flex-wrap items-center gap-2">
                  <Actions row={row} />
                  <DeleteIconButton label="Delete punch item" message={`Delete the punch item "${row.description}"?`} onConfirm={() => deletePunchItem(row.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
