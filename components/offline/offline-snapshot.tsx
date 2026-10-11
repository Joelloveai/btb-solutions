"use client";

import { useEffect } from "react";
import type { ProjectSnapshot } from "@/lib/offline/db";
import { getSnapshot, saveSnapshot } from "@/lib/offline/outbox";
import { thumbnailFromUrl } from "@/lib/offline/thumb";
import { useOffline } from "./offline-provider";

const KEEP = 100;
const THUMBS = 12;

type SnapshotInput = Omit<ProjectSnapshot, "savedAt">;

/**
 * Renders nothing. While the app is online it keeps a copy of the project's latest entries (and a few
 * small photo thumbnails) on the device, so they can still be read in a basement with no signal.
 */
export function OfflineSnapshot({ data }: { data: SnapshotInput }) {
  const { online } = useOffline();
  const signature = JSON.stringify(data);

  useEffect(() => {
    if (!online) return; // never overwrite saved data with an older cached page
    let alive = true;
    (async () => {
      const previous = await getSnapshot(data.projectId);
      const photos = [];
      for (const [index, photo] of data.photos.entries()) {
        const kept = previous?.photos.find((p) => p.id === photo.id)?.thumb;
        const thumb = kept ?? (index < THUMBS ? await thumbnailFromUrl(`/api/photos/${photo.id}`) : null);
        photos.push({ ...photo, ...(thumb ? { thumb } : {}) });
        if (!alive) return;
      }
      await saveSnapshot({
        ...data,
        costs: data.costs.slice(0, KEEP),
        payments: data.payments.slice(0, KEEP),
        tasks: data.tasks.slice(0, KEEP),
        photos,
        savedAt: Date.now(),
      });
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
    // `signature` stands in for the whole data object so the snapshot refreshes when anything changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, online]);

  return null;
}
