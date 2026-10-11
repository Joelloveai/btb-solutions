"use client";

import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOffline } from "./offline-provider";
import { PendingOpRow } from "./pending-ops";
import { useOutbox } from "./use-outbox";

/**
 * A slim status strip, never a blocking dialog: it only appears when something is worth knowing
 * (no signal, changes syncing, or changes that need a person to look at them).
 */
export function OfflineIndicator() {
  const { online, pending, failed, syncing, authNeeded, syncNow } = useOffline();
  const ops = useOutbox();
  const [open, setOpen] = useState(false);

  if (online && pending === 0 && failed === 0 && !syncing && !authNeeded) return null;

  const tone = !online ? "bg-pending-light text-pending-dark border-pending/30" : failed > 0 || authNeeded ? "bg-loss-light text-loss-dark border-loss/30" : "bg-muted text-foreground border-border";
  const Icon = !online ? CloudOff : failed > 0 || authNeeded ? TriangleAlert : RefreshCw;
  const message = !online
    ? "Offline — changes will sync when connected."
    : authNeeded
      ? "Sign in again to sync your saved changes."
      : failed > 0
        ? `${failed} change${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} attention.`
        : `Syncing ${pending} saved change${pending === 1 ? "" : "s"}…`;

  return (
    <>
      <div role="status" aria-live="polite" data-testid="offline-indicator" className={`flex items-center justify-between gap-2 border-b px-3 py-1 text-xs font-medium lg:px-6 ${tone}`}>
        <span className="flex min-w-0 items-center gap-2">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
          <span className="truncate">
            {message}
            {!online && pending > 0 ? ` (${pending} waiting)` : ""}
          </span>
        </span>
        {pending + failed > 0 ? (
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 min-h-12 rounded px-3 underline underline-offset-2">
            View
          </button>
        ) : null}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Saved, waiting for signal</DialogTitle>
            <DialogDescription>Saved on this phone. They are sent automatically when you have signal.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {ops.map((op) => (
              <PendingOpRow key={op.id} op={op} />
            ))}
            {ops.length === 0 ? <li className="text-sm text-muted-foreground">Everything is synced.</li> : null}
          </ul>
          {online ? (
            <Button variant="secondary" onClick={() => void syncNow()} disabled={syncing}>
              Sync now
            </Button>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
