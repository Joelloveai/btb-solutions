"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { updatePayment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Lookups } from "@/components/projects/lookups";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { useCallback, useState } from "react";
import { EditIconButton } from "./row-actions";
import { todayInputValue } from "@/lib/format";
import { paymentSchema, type PaymentInput } from "@/lib/validators";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { useSubmit } from "./use-submit";

function Form({
  projectId,
  lookups,
  close,
  editing,
}: {
  projectId: string;
  lookups: Lookups;
  close: () => void;
  editing?: { id: string; values: PaymentInput };
}) {
  const update = useSubmit("Payment updated", close);
  const add = useOfflineSubmit("Payment added", close);
  const pending = editing ? update.pending : add.pending;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: editing?.values ?? { date: todayInputValue(), amount: "", reference: "", claimId: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) =>
      editing
        ? update.submit(() => updatePayment(editing.id, values))
        : add.submit({ type: "addPayment", projectId, label: `Payment: RM ${values.amount}${values.reference ? ` · ${values.reference}` : ""}`, payload: { input: values } }),
    )} className="space-y-3">
      <Field label="Date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Amount (RM)" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      {lookups.claims.length > 0 ? (
        <Field label="Against claim (optional)" error={errors.claimId?.message}>
          <Select {...register("claimId")}>
            <option value="">— Not linked to a claim —</option>
            {lookups.claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Reference / note (optional)" error={errors.reference?.message}>
        <Input {...register("reference")} placeholder="e.g. Progress claim 1" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save payment"}
      </Button>
    </form>
  );
}

export function AddPaymentForm({ projectId, lookups }: { projectId: string; lookups: Lookups }) {
  return (
    <ModalButton label="+ Add Payment" title="Add payment">
      {(close) => <Form projectId={projectId} lookups={lookups} close={close} />}
    </ModalButton>
  );
}

export function EditPaymentButton({
  projectId,
  lookups,
  id,
  values,
}: {
  projectId: string;
  lookups: Lookups;
  id: string;
  values: PaymentInput;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <EditIconButton label="Edit payment" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={close} title="Edit payment">
        <Form projectId={projectId} lookups={lookups} close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
