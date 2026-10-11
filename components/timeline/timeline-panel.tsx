"use client";

import clsx from "clsx";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FileText,
  Flag,
  HardHat,
  Layers,
  MapPin,
  MessageSquare,
  Receipt,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TIMELINE_FILTERS } from "@/lib/constants";
import type { TimelineItem } from "@/lib/timeline-query";

const ICONS: Record<string, LucideIcon> = {
  PHOTO: Camera,
  COST: Receipt,
  PAYMENT: Wallet,
  CLAIM: FileText,
  CHANGE_ORDER: Layers,
  TASK_CREATED: ClipboardList,
  TASK_COMPLETED: CheckCircle2,
  PUNCH_CREATED: Flag,
  PUNCH_RESOLVED: BadgeCheck,
  DOCUMENT_UPLOADED: FileText,
  SITE_DIARY: HardHat,
  MESSAGE: MessageSquare,
  APPROVAL: BadgeCheck,
  STAGE_CHANGED: Flag,
  NOTE: StickyNote,
};

const KL = "Asia/Kuala_Lumpur";
const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: KL }).format(new Date(ms));
const timeText = (ms: number) => new Intl.DateTimeFormat("en-GB", { timeZone: KL, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));

function dayLabel(key: string, now = Date.now()) {
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(now - 86_400_000)) return "Yesterday";
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

type Page = { items: TimelineItem[]; nextCursor: string | null };

export function TimelinePanel({ projectId, initial }: { projectId: string; initial: Page }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState<Page>(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  // A fresh server render (after a save) replaces what is shown, unless a filter is active.
  useEffect(() => {
    if (filter === "all") setPage(initial);
  }, [initial, filter]);

  const load = useCallback(
    async (nextFilter: string, cursor: string | null, replace: boolean) => {
      setLoading(true);
      setFailed(false);
      try {
        const query = new URLSearchParams({ filter: nextFilter });
        if (cursor) query.set("cursor", cursor);
        const response = await fetch(`/api/projects/${projectId}/timeline?${query}`);
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as Page;
        setPage((current) => ({ items: replace ? data.items : [...current.items, ...data.items], nextCursor: data.nextCursor }));
      } catch {
        setFailed(true); // offline: what is already shown stays; more loads when signal returns
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  const choose = (id: string) => {
    setFilter(id);
    if (id === "all") setPage(initial);
    else {
      setPage({ items: [], nextCursor: null });
      void load(id, null, true);
    }
  };

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !page.nextCursor || loading || failed) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void load(filter, page.nextCursor, false);
    }, { rootMargin: "400px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [page.nextCursor, loading, failed, filter, load]);

  const days: { key: string; items: TimelineItem[] }[] = [];
  for (const item of page.items) {
    const key = dayKey(item.capturedAtMs);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(item);
    else days.push({ key, items: [item] });
  }

  return (
    <section aria-label="Timeline" className="space-y-4">
      <div className="space-y-3">
        <a
          href={`/api/projects/${projectId}/timeline/pack`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileDown className="h-4 w-4" aria-hidden="true" />
          Export Evidence Pack
        </a>
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
          {TIMELINE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => choose(f.id)}
              className={clsx(
                "min-h-12 rounded-full border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f.id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {days.length === 0 && !loading ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="timeline-empty">
          Nothing here yet. Use the + button to add a photo, note or cost. Everything you add is kept as a permanent record.
        </p>
      ) : null}

      {days.map((day) => (
        <div key={day.key} className="space-y-2">
          <h3 className="sticky top-0 z-10 bg-background/95 py-1 text-sm font-semibold text-muted-foreground" data-testid="timeline-day">
            {dayLabel(day.key)}
          </h3>
          <ol className="space-y-2">
            {day.items.map((item) => {
              const Icon = ICONS[item.type] ?? StickyNote;
              const struck = item.action === "deleted";
              return (
                <li key={item.id} data-testid="timeline-event" data-type={item.type} className="flex gap-3 rounded-xl border bg-card p-3 shadow-sm">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={clsx("text-sm font-medium", struck && "text-muted-foreground")}>{item.title}</p>
                    {item.description ? <p className="mt-0.5 break-words text-sm text-muted-foreground">{item.description}</p> : null}
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{item.actorName ?? item.actorRole}</span>
                      <span aria-hidden="true">·</span>
                      <span>{timeText(item.capturedAtMs)}</span>
                      {item.hasGps ? (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" aria-hidden="true" /> GPS
                        </span>
                      ) : null}
                    </p>
                    {item.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photos/${item.photoId}`} alt={item.description ?? "Photo"} loading="lazy" className="mt-2 h-28 w-28 rounded-lg border object-cover" />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      <div ref={sentinel} aria-hidden="true" />
      {loading ? <p className="text-center text-sm text-muted-foreground">Loading…</p> : null}
      {failed ? (
        <button type="button" onClick={() => load(filter, page.nextCursor, filter !== "all" && page.items.length === 0)} className="min-h-12 w-full rounded-xl border text-sm text-muted-foreground">
          Could not load more (no signal?). Tap to try again.
        </button>
      ) : null}
    </section>
  );
}
