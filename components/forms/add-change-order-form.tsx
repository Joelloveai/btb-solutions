"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addChangeOrder, updateChangeOrder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Lookups } from "@/components/projects/lookups";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { useCallback, useState } from "react";
import { EditIconButton } from "./row-actions";
import { todayInputValue } from "@/lib/format";
import { changeOrderSchema, type ChangeOrderInput } from "@/lib/validators";
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
  editing?: { id: string; values: ChangeOrderInput };
}) {
  const { pending, submit } = useSubmit(editing ? "Change order updated" : "Change order added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeOrderInput>({
    resolver: zodResolver(changeOrderSchema),
    defaultValues: editing?.values ?? { date: todayInputValue(), description: "", amount: "", boqLineId: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => (editing ? updateChangeOrder(editing.id, values) : addChangeOrder(projectId, values))))} className="space-y-3">
      <Field label="Date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <Input {...register("description")} placeholder="e.g. Extra kitchen cabinet" />
      </Field>
      <Field label="Amount (RM) — use minus for omissions" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      {lookups.boqLines.length > 0 ? (
        <Field label="BOQ line (optional)" error={errors.boqLineId?.message}>
          <Select {...register("boqLineId")}>
            <option value="">— Not linked —</option>
            {lookups.boqLines.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <p className="text-sm text-muted-foreground">Status starts as Pending. Approve it from the list.</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save change order"}
      </Button>
    </form>
  );
}

export function AddChangeOrderForm({ projectId, lookups }: { projectId: string; lookups: Lookups }) {
  return (
    <ModalButton label="+ Add Change Order" title="Add change order">
      {(close) => <Form projectId={projectId} lookups={lookups} close={close} />}
    </ModalButton>
  );
}

export function EditChangeOrderButton({
  projectId,
  lookups,
  id,
  values,
}: {
  projectId: string;
  lookups: Lookups;
  id: string;
  values: ChangeOrderInput;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <EditIconButton label="Edit change order" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={close} title="Edit change order">
        <Form projectId={projectId} lookups={lookups} close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
