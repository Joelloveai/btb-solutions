"use client";

import { deletePhoto } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { ImageViewer } from "./image-viewer";

export type PhotoItem = { id: string; caption: string | null; takenAtText: string };

/** Thumbnails with caption, date and time. Staff get a delete button; clients see a read-only gallery. */
export function PhotoGallery({ photos, canDelete = false, emptyText }: { photos: PhotoItem[]; canDelete?: boolean; emptyText: string }) {
  if (photos.length === 0) return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
      {photos.map((photo) => (
        <li key={photo.id} className="overflow-hidden rounded-xl border bg-card shadow-sm print:break-inside-avoid">
          <ImageViewer id={photo.id} title={photo.caption ?? "Progress photo"} caption={photo.caption}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${photo.id}`} alt={photo.caption ?? "Progress photo"} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          </ImageViewer>
          <div className="flex items-start justify-between gap-1 p-2">
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
        </li>
      ))}
    </ul>
  );
}
