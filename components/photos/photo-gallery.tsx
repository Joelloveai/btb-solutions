"use client";

import { Columns2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { deletePhoto } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { PHOTO_PHASES, PHOTO_TRADES } from "@/lib/constants";
import { ImageViewer } from "./image-viewer";

export type PhotoItem = {
  id: string;
  caption: string | null;
  /** When it was taken (the phone's clock when available), as readable text. */
  takenAtText: string;
  /** For ordering a comparison (milliseconds since 1970). */
  takenAtMs?: number;
  /** Set only when the photo reached the server noticeably later than it was taken. */
  uploadedLaterText?: string | null;
  phase?: string | null;
  trade?: string | null;
  location?: string | null;
  /** Staff only: where the phone said it was. */
  gps?: { text: string; href: string } | null;
};

type Props = { photos: PhotoItem[]; canDelete?: boolean; emptyText: string; organize?: boolean; compare?: boolean };

function Card({ photo, canDelete, selectMode, selected, onToggle }: { photo: PhotoItem; canDelete: boolean; selectMode: boolean; selected: boolean; onToggle: () => void }) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/photos/${photo.id}`} alt={photo.caption ?? "Site photo"} loading="lazy" className="aspect-[4/3] w-full object-cover" />
  );
  return (
    <li className={`overflow-hidden rounded-xl border bg-card shadow-sm print:break-inside-avoid ${selected ? "ring-2 ring-accent" : ""}`}>
      {selectMode ? (
        <button type="button" onClick={onToggle} aria-pressed={selected} aria-label={`Select photo: ${photo.caption ?? photo.takenAtText}`} className="relative block w-full">
          {image}
          <span className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${selected ? "border-accent bg-accent text-white" : "border-white bg-black/30 text-transparent"}`}>✓</span>
        </button>
      ) : (
        <ImageViewer id={photo.id} title={photo.caption ?? "Site photo"} caption={photo.caption}>
          {image}
        </ImageViewer>
      )}
      <div className="space-y-1 p-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            {photo.caption ? <p className="truncate text-sm font-medium">{photo.caption}</p> : null}
            <p className="text-xs text-muted-foreground">{photo.takenAtText}</p>
          </div>
          {canDelete ? (
            <div className="print:hidden">
              <DeleteIconButton label="Delete photo" message="Delete this photo? Clients will no longer see it." onConfirm={() => deletePhoto(photo.id)} />
            </div>
          ) : null}
        </div>
        {photo.phase || photo.trade ? (
          <p className="flex flex-wrap gap-1">
            {photo.phase ? <Badge tone="blue">{photo.phase}</Badge> : null}
            {photo.trade ? <Badge tone="gray">{photo.trade}</Badge> : null}
          </p>
        ) : null}
        {photo.location ? <p className="truncate text-xs text-muted-foreground">{photo.location}</p> : null}
        {photo.uploadedLaterText ? <p className="text-[11px] text-pending-dark">Uploaded {photo.uploadedLaterText}</p> : null}
        {photo.gps ? (
          <a href={photo.gps.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline print:hidden">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {photo.gps.text}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Grid(props: { photos: PhotoItem[]; canDelete: boolean; selectMode: boolean; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
      {props.photos.map((photo) => (
        <Card key={photo.id} photo={photo} canDelete={props.canDelete} selectMode={props.selectMode} selected={props.selected.includes(photo.id)} onToggle={() => props.onToggle(photo.id)} />
      ))}
    </ul>
  );
}

/**
 * Photos with their caption, date and time. `organize` files them by phase then trade with filters (the
 * contractor's view); `compare` lets two photos be put side by side (the same spot on different dates).
 */
export function PhotoGallery({ photos, canDelete = false, emptyText, organize = false, compare = false }: Props) {
  const [phase, setPhase] = useState("");
  const [trade, setTrade] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const shown = useMemo(() => photos.filter((p) => (!phase || (p.phase ?? "") === phase) && (!trade || (p.trade ?? "") === trade)), [photos, phase, trade]);
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= 2 ? [current[1]!, id] : [...current, id]));
  const pair = selected
    .map((id) => photos.find((p) => p.id === id))
    .filter((p): p is PhotoItem => !!p)
    .sort((a, b) => (a.takenAtMs ?? 0) - (b.takenAtMs ?? 0));

  if (photos.length === 0) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  const grouped = organize
    ? [...PHOTO_PHASES, ""].map((p) => ({ phase: p, photos: shown.filter((x) => (x.phase ?? "") === p) })).filter((g) => g.photos.length > 0)
    : [];

  return (
    <div className="space-y-4">
      {organize || compare ? (
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          {organize ? (
            <>
              <label className="text-xs font-medium text-muted-foreground">
                Phase
                <Select value={phase} onChange={(e) => setPhase(e.target.value)} className="mt-1 w-40" aria-label="Filter by phase">
                  <option value="">All phases</option>
                  {PHOTO_PHASES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Trade
                <Select value={trade} onChange={(e) => setTrade(e.target.value)} className="mt-1 w-40" aria-label="Filter by trade">
                  <option value="">All trades</option>
                  {PHOTO_TRADES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </label>
            </>
          ) : null}
          {compare && photos.length >= 2 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelectMode((v) => !v);
                setSelected([]);
              }}
            >
              <Columns2 className="h-4 w-4" aria-hidden="true" />
              {selectMode ? "Cancel compare" : "Compare photos"}
            </Button>
          ) : null}
          {selectMode ? (
            <Button type="button" disabled={selected.length !== 2} onClick={() => setComparing(true)}>
              Compare {selected.length}/2 selected
            </Button>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No photos match those filters.</p>
      ) : organize ? (
        grouped.map((group) => (
          <section key={group.phase || "untagged"} aria-label={`${group.phase || "Untagged"} photos`} className="space-y-2">
            <h3 className="text-sm font-semibold">
              {group.phase || "No phase set"} <span className="font-normal text-muted-foreground">({group.photos.length})</span>
            </h3>
            {[...PHOTO_TRADES, ""].map((t) => {
              const inTrade = group.photos.filter((p) => (p.trade ?? "") === t);
              return inTrade.length === 0 ? null : (
                <div key={t || "none"} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t || "No trade set"}</p>
                  <Grid photos={inTrade} canDelete={canDelete} selectMode={selectMode} selected={selected} onToggle={toggle} />
                </div>
              );
            })}
          </section>
        ))
      ) : (
        <Grid photos={shown} canDelete={canDelete} selectMode={selectMode} selected={selected} onToggle={toggle} />
      )}

      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="md:max-w-5xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Compare photos</DialogTitle>
            <DialogDescription>Earlier on the left, later on the right.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2" data-testid="comparison">
            {pair.map((photo, index) => (
              <figure key={photo.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photos/${photo.id}`} alt={photo.caption ?? `Photo ${index + 1}`} className="max-h-[60vh] w-full rounded-md border object-contain" />
                <figcaption className="text-sm">
                  <span className="font-medium">{photo.takenAtText}</span>
                  {photo.location ? <span className="block text-xs text-muted-foreground">{photo.location}</span> : null}
                  {photo.caption ? <span className="block text-xs text-muted-foreground">{photo.caption}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
