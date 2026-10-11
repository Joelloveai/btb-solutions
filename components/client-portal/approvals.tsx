"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveSelection, decideChangeOrder } from "@/app/actions";
import { useOffline } from "@/components/offline/offline-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const OFFLINE_MESSAGE = "You are offline. An approval is recorded with the time it reaches us, so please try again when you have signal.";

export type ChangeOrderApprovalRow = { id: string; description: string; dateText: string; amountText: string; status: "PENDING" | "APPROVED" | "REJECTED"; decisionText: string | null; canDecide: boolean };
export type SelectionApprovalRow = { id: string; category: string; name: string; details: string | null; photoId: string | null; approvedText: string | null };

/** Ask "are you sure?" first: approving a change order changes the price of the job. */
function Confirm({ open, title, description, confirmLabel, pending, onCancel, onConfirm }: { open: boolean; title: string; description: string; confirmLabel: string; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChangeOrderApprovals({ rows }: { rows: ChangeOrderApprovalRow[] }) {
  const router = useRouter();
  const { online } = useOffline();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<{ row: ChangeOrderApprovalRow; decision: "APPROVED" | "REJECTED" } | null>(null);

  const decide = () =>
    startTransition(async () => {
      if (!asking) return;
      if (!online) return void toast.error(OFFLINE_MESSAGE);
      const result = await decideChangeOrder(asking.row.id, asking.decision);
      if (result.ok) {
        toast.success(asking.decision === "APPROVED" ? "Approved. Thank you." : "Rejected.");
        setAsking(null);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <>
      <ul className="space-y-2" data-testid="change-orders">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="p-3" data-testid="client-change-order">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{row.description}</p>
                  <p className="text-xs text-muted-foreground">{row.dateText}</p>
                </div>
                <p className="font-mono text-lg font-semibold tabular-nums">{row.amountText}</p>
              </div>
              {row.canDecide ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => setAsking({ row, decision: "APPROVED" })}>Approve</Button>
                  <Button variant="secondary" onClick={() => setAsking({ row, decision: "REJECTED" })}>
                    Reject
                  </Button>
                </div>
              ) : (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={row.status === "APPROVED" ? "green" : row.status === "REJECTED" ? "red" : "yellow"}>{row.status === "APPROVED" ? "Approved" : row.status === "REJECTED" ? "Rejected" : "Pending"}</Badge>
                  {row.decisionText ? <span className="text-muted-foreground">{row.decisionText}</span> : null}
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Confirm
        open={!!asking}
        title={asking?.decision === "APPROVED" ? "Approve this change order?" : "Reject this change order?"}
        description={asking ? `${asking.row.description}: ${asking.row.amountText}. ${asking.decision === "APPROVED" ? "This changes the price of your job." : "The work will not go ahead and the price will not change."} Your decision is recorded with the date and time.` : ""}
        confirmLabel={asking?.decision === "APPROVED" ? "Yes, approve" : "Yes, reject"}
        pending={pending}
        onCancel={() => setAsking(null)}
        onConfirm={decide}
      />
    </>
  );
}

export function SelectionApprovals({ rows }: { rows: SelectionApprovalRow[] }) {
  const router = useRouter();
  const { online } = useOffline();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<SelectionApprovalRow | null>(null);

  const approve = () =>
    startTransition(async () => {
      if (!asking) return;
      if (!online) return void toast.error(OFFLINE_MESSAGE);
      const result = await approveSelection(asking.id);
      if (result.ok) {
        toast.success("Approved. Thank you.");
        setAsking(null);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2" data-testid="selections">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="flex h-full flex-col gap-2 p-3" data-testid="client-selection">
              <div className="flex items-start gap-3">
                {row.photoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/photos/${row.photoId}`} alt={`Sample: ${row.name}`} className="h-16 w-16 shrink-0 rounded-md object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.category}
                    {row.details ? ` · ${row.details}` : ""}
                  </p>
                </div>
              </div>
              {row.approvedText ? (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="green">Approved</Badge>
                  <span className="text-muted-foreground">by you on {row.approvedText}</span>
                </p>
              ) : (
                <Button onClick={() => setAsking(row)} aria-label={`Approve ${row.name}`}>
                  Approve
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Confirm
        open={!!asking}
        title="Approve this selection?"
        description={asking ? `${asking.name}. We will order or apply exactly this. Your approval is recorded with the date and time.` : ""}
        confirmLabel="Yes, approve"
        pending={pending}
        onCancel={() => setAsking(null)}
        onConfirm={approve}
      />
    </>
  );
}
