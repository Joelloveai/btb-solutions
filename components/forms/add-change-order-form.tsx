"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { addChangeOrder, updateChangeOrder } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Lookups } from "@/components/projects/lookups";
import { Field, Input, Select } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
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
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeOrderInput>({
    resolver: zodResolver(changeOrderSchema),
    defaultValues: editing?.values ?? { date: todayInputValue(), description: "", amount: "", boqLineId: "", voType: "ADDITION", timeExtensionDays: "", submittedBy: "" },
  });

  const voType = useWatch({ control, name: "voType" });
  return (
    <form onSubmit={handleSubmit((values) => submit(() => (editing ? updateChangeOrder(editing.id, values) : addChangeOrder(projectId, values))))} className="space-y-3">
      <Field label="Date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <VoiceInput {...register("description")} placeholder="e.g. Extra kitchen cabinet" />
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
      <details className="group rounded-md border border-input">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          <span>More</span>
          <span className="text-muted-foreground group-open:hidden">type, days, who asked</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <Field label="Type of variation">
            <Select {...register("voType")}>
              <option value="ADDITION">Addition</option>
              <option value="OMISSION">Omission</option>
              <option value="TIME_EXTENSION">Time extension (no money)</option>
            </Select>
          </Field>
          {voType === "TIME_EXTENSION" ? (
            <Field label="Days added to the contract" error={errors.timeExtensionDays?.message}>
              <Input {...register("timeExtensionDays")} inputMode="numeric" />
            </Field>
          ) : null}
          <Field label="Requested by">
            <Input {...register("submittedBy")} placeholder="e.g. the client's name" />
          </Field>
        </div>
      </details>
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
