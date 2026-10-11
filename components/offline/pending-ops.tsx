"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OpType, OutboxOp } from "@/lib/offline/db";
import { removeOp, retryOp } from "@/lib/offline/outbox";
import { useOffline } from "./offline-provider";
import { useOutbox } from "./use-outbox";

function Thumb({ op }: { op: OutboxOp }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!op.file || !op.file.type.startsWith("image/")) return;
    const objectUrl = URL.createObjectURL(new Blob([op.file.bytes], { type: op.file.type }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [op.file]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="Photo waiting to upload" className="h-12 w-12 shrink-0 rounded-md object-cover" /> : null;
}

/** One queued change, with its status and (if it failed) what to do about it. */
export function PendingOpRow({ op }: { op: OutboxOp }) {
  const { syncNow, online } = useOffline();
  const failed = op.status === "failed";
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3" data-testid="pending-op">
      <Thumb op={op} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{op.label}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge tone={failed ? "red" : "yellow"}>{failed ? "Needs attention" : "Pending sync"}</Badge>
          saved {new Date(op.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        {failed && op.error ? <p className="mt-1 text-xs text-loss">{op.error}</p> : null}
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {failed ? (
          <Button
            small
            variant="secondary"
            onClick={async () => {
              await retryOp(op.id);
              if (online) void syncNow();
            }}
          >
            Retry
          </Button>
        ) : null}
        <Button small variant="ghost" onClick={() => removeOp(op.id)} aria-label={`Discard: ${op.label}`}>
          Discard
        </Button>
      </div>
    </li>
  );
}

/** Changes made on this phone that the server has not confirmed yet, shown where they belong. */
export function PendingOps({ projectId, types }: { projectId?: string; types?: OpType[] }) {
  const ops = useOutbox().filter((op) => (!projectId || op.projectId === projectId) && (!types || types.includes(op.type)));
  if (ops.length === 0) return null;
  return (
    <ul className="mb-3 space-y-2" aria-label="Waiting to sync">
      {ops.map((op) => (
        <PendingOpRow key={op.id} op={op} />
      ))}
    </ul>
  );
}
