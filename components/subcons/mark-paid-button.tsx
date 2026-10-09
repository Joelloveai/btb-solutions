"use client";

import { useCallback, useState } from "react";
import { setCostPaid } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useLocale } from "@/components/locale-provider";
import { formatDate, todayInputValue } from "@/lib/format";

/** Marks a subcon cost as paid on a chosen date, or undoes it. */
export function MarkPaidButton({ costId, paidAt }: { costId: string; paidAt: string | null }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayInputValue());
  const close = useCallback(() => setOpen(false), []);
  const paid = useSubmit("Marked as paid", close);
  const undo = useSubmit("Marked as unpaid", () => {});

  if (paidAt) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Badge tone="green">{`Paid ${formatDate(paidAt, locale)}`}</Badge>
        <Button small variant="ghost" disabled={undo.pending} onClick={() => undo.submit(() => setCostPaid(costId, null))}>
          Undo
        </Button>
      </span>
    );
  }

  return (
    <>
      <Button small variant="secondary" onClick={() => setOpen(true)}>
        Mark as Paid
      </Button>
      <Modal open={open} onClose={close} title="Mark as paid">
        <div className="space-y-3">
          <Field label="Date paid">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Button className="w-full" disabled={paid.pending} onClick={() => paid.submit(() => setCostPaid(costId, date))}>
            {paid.pending ? "Saving…" : "Confirm paid"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
