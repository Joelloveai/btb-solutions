"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addPayment, updatePayment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { useCallback, useState } from "react";
import { EditIconButton } from "./row-actions";
import { todayInputValue } from "@/lib/format";
import { paymentSchema, type PaymentInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({
  projectId,
  close,
  editing,
}: {
  projectId: string;
  close: () => void;
  editing?: { id: string; values: PaymentInput };
}) {
  const { pending, submit } = useSubmit(editing ? "Payment updated" : "Payment added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: editing?.values ?? { date: todayInputValue(), amount: "", reference: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => (editing ? updatePayment(editing.id, values) : addPayment(projectId, values))))} className="space-y-3">
      <Field label="Date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Amount (RM)" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      <Field label="Reference / note (optional)" error={errors.reference?.message}>
        <Input {...register("reference")} placeholder="e.g. Progress claim 1" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save payment"}
      </Button>
    </form>
  );
}

export function AddPaymentForm({ projectId }: { projectId: string }) {
  return (
    <ModalButton label="+ Add Payment" title="Add payment">
      {(close) => <Form projectId={projectId} close={close} />}
    </ModalButton>
  );
}

export function EditPaymentButton({
  projectId,
  id,
  values,
}: {
  projectId: string;
  id: string;
  values: PaymentInput;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <EditIconButton label="Edit payment" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={close} title="Edit payment">
        <Form projectId={projectId} close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
