"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addChangeOrder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { todayInputValue } from "@/lib/format";
import { changeOrderSchema, type ChangeOrderInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useSubmit("Change order added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeOrderInput>({
    resolver: zodResolver(changeOrderSchema),
    defaultValues: { date: todayInputValue(), description: "", amount: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => addChangeOrder(projectId, values)))} className="space-y-3">
      <Field label="Date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <Input {...register("description")} placeholder="e.g. Extra kitchen cabinet" />
      </Field>
      <Field label="Amount (RM) — use minus for omissions" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      <p className="text-sm text-gray-600">Status starts as Pending. Approve it from the list.</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save change order"}
      </Button>
    </form>
  );
}

export function AddChangeOrderForm({ projectId }: { projectId: string }) {
  return (
    <ModalButton label="+ Add Change Order" title="Add change order">
      {(close) => <Form projectId={projectId} close={close} />}
    </ModalButton>
  );
}
