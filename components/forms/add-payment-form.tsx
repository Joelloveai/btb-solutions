"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addPayment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { todayInputValue } from "@/lib/format";
import { paymentSchema, type PaymentInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useSubmit("Payment added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { date: todayInputValue(), amount: "", reference: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => addPayment(projectId, values)))} className="space-y-3">
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
