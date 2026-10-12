import type { Prisma } from "@prisma/client";
import { TIMELINE_EVENT_TYPES, TIMELINE_FILTERS } from "@/lib/constants";
import { FINANCIAL_EVENT_TYPES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type TimelineItem = {
  id: string;
  seq: number;
  type: string;
  title: string;
  description: string | null;
  actorName: string | null;
  actorRole: string;
  capturedAtMs: number;
  /** Set when the event is about a photo, so the card can show a thumbnail. */
  photoId: string | null;
  hasGps: boolean;
  /** "added", "deleted", "updated"...: removed or corrected rows are shown as such, never hidden. */
  action: string | null;
};

export const PAGE_SIZE = 30;

const parse = (text: string): Record<string, unknown> => {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** Cursor is "<capturedAt ms>_<seq>": newest first, with seq breaking ties. */
export async function fetchTimelinePage(projectId: string, filterId: string, cursor?: string | null, showFinancial = true) {
  const filter = TIMELINE_FILTERS.find((f) => f.id === filterId) ?? TIMELINE_FILTERS[0];
  const where: Prisma.TimelineEventWhereInput = { projectId };
  // Without financial access, payments, claims and change orders are not part of the timeline they see.
  const allowed = (filter.types ?? TIMELINE_EVENT_TYPES).filter((t) => showFinancial || !(FINANCIAL_EVENT_TYPES as readonly string[]).includes(t));
  if (filter.types || !showFinancial) where.eventType = { in: [...allowed] };
  const match = cursor ? /^(\d+)_(\d+)$/.exec(cursor) : null;
  if (match) {
    const at = new Date(Number(match[1]));
    where.OR = [{ capturedAt: { lt: at } }, { capturedAt: at, seq: { lt: Number(match[2]) } }];
  }
  const rows = await prisma.timelineEvent.findMany({
    where,
    orderBy: [{ capturedAt: "desc" }, { seq: "desc" }],
    take: PAGE_SIZE + 1,
  });
  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const items: TimelineItem[] = page.map((e) => {
    const meta = parse(e.metadata);
    return {
      id: e.id,
      seq: e.seq,
      type: e.eventType,
      title: e.title,
      description: e.description,
      actorName: e.actorName,
      actorRole: e.actorRole,
      capturedAtMs: e.capturedAt.getTime(),
      photoId: e.eventType === "PHOTO" && meta.action === "added" && typeof meta.photoId === "string" ? meta.photoId : null,
      hasGps: e.latitude !== null && e.longitude !== null,
      action: typeof meta.action === "string" ? meta.action : null,
    };
  });
  return { items, nextCursor: rows.length > PAGE_SIZE && last ? `${last.capturedAt.getTime()}_${last.seq}` : null };
}
