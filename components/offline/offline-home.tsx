"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProjectSnapshot, StoredFile } from "@/lib/offline/db";
import { listSnapshots } from "@/lib/offline/outbox";
import { PendingOps } from "./pending-ops";

function Thumb({ file, alt }: { file: StoredFile; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(new Blob([file.bytes], { type: file.type }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className="aspect-[4/3] w-full rounded-md object-cover" /> : null;
}

/** Read-only view of the project data saved on this phone, plus anything waiting to sync. */
export function OfflineHome() {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    listSnapshots().then(setSnapshots).catch(() => setSnapshots([]));
  }, []);

  const current = snapshots?.find((s) => s.projectId === selected);

  return (
    <div className="mt-6 space-y-4">
      <PendingOps />
      {snapshots === null ? null : snapshots.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing is saved on this phone yet. Open your projects while you have signal and they will be here next time.
        </p>
      ) : current ? (
        <div className="space-y-4" data-testid="offline-project">
          <button type="button" className="text-sm font-medium text-muted-foreground underline" onClick={() => setSelected(null)}>
            ← All saved projects
          </button>
          <h2 className="text-lg font-semibold">{current.name}</h2>
          <p className="text-xs text-muted-foreground">Saved {new Date(current.savedAt).toLocaleString()}</p>
          <Section title="Costs">
            {current.costs.map((c) => (
              <Row key={c.id} left={`${c.description} · ${c.category}`} sub={c.dateText} right={c.amountText} />
            ))}
          </Section>
          <Section title="Payments">
            {current.payments.map((p) => (
              <Row key={p.id} left={p.reference ?? "Payment"} sub={p.dateText} right={p.amountText} />
            ))}
          </Section>
          <Section title="Tasks">
            {current.tasks.map((t) => (
              <Row key={t.id} left={t.description} sub={`${t.subcontractorName ?? "Own crew"} · due ${t.dueText}`} right={t.status === "DONE" ? "Done" : "Open"} />
            ))}
          </Section>
          {current.photos.some((p) => p.thumb) ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Photos</h3>
              <ul className="grid grid-cols-3 gap-2">
                {current.photos.map((p) =>
                  p.thumb ? (
                    <li key={p.id}>
                      <Thumb file={p.thumb} alt={p.caption ?? "Site photo"} />
                      <p className="mt-1 truncate text-xs text-muted-foreground">{p.caption ?? p.takenAtText}</p>
                    </li>
                  ) : null,
                )}
              </ul>
            </section>
          ) : null}
        </div>
      ) : (
        <ul className="space-y-2">
          {snapshots.map((s) => (
            <li key={s.projectId}>
              <button type="button" onClick={() => setSelected(s.projectId)} className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="flex items-center justify-between gap-2 p-4">
                  <span className="font-medium">{s.name}</span>
                  <Badge tone="gray">{`${s.costs.length} costs`}</Badge>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode[] }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children.length === 0 ? <p className="text-sm text-muted-foreground">None saved.</p> : <ul className="divide-y rounded-xl border bg-card">{children}</ul>}
    </section>
  );
}

function Row({ left, sub, right }: { left: string; sub: string; right: string }) {
  return (
    <li className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{left}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <p className="shrink-0 font-mono text-sm">{right}</p>
    </li>
  );
}
