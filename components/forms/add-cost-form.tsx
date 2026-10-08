"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addCost, updateCost } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { useCallback, useState } from "react";
import { EditIconButton } from "./row-actions";
import { CATEGORY_LABELS, COST_CATEGORIES } from "@/lib/constants";
import { todayInputValue } from "@/lib/format";
import { costSchema, type CostInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({
  projectId,
  close,
  editing,
}: {
  projectId: string;
  close: () => void;
  editing?: { id: string; values: CostInput };
}) {
  const { pending, submit } = useSubmit(editing ? "Cost updated" : "Cost added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CostInput>({
    resolver: zodResolver(costSchema),
    defaultValues: editing?.values ?? {
      date: todayInputValue(),
      category: "MATERIAL",
      description: "",
      amount: "",
      vendor: "",
      reference: "",
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => (editing ? updateCost(editing.id, values) : addCost(projectId, values))))} className="space-y-3">
      <Field label="Date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Category" error={errors.category?.message}>
        <Select {...register("category")}>
          {COST_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" error={errors.description?.message}>
        <Input {...register("description")} placeholder="e.g. Cement 50 bags" />
      </Field>
      <Field label="Amount (RM)" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      <Field label="Vendor (optional)" error={errors.vendor?.message}>
        <Input {...register("vendor")} />
      </Field>
      <Field label="Reference (optional)" error={errors.reference?.message}>
        <Input {...register("reference")} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save cost"}
      </Button>
    </form>
  );
}

export function AddCostForm({ projectId }: { projectId: string }) {
  return (
    <ModalButton label="+ Add Cost" title="Add cost">
      {(close) => <Form projectId={projectId} close={close} />}
    </ModalButton>
  );
}

export function EditCostButton({
  projectId,
  id,
  values,
}: {
  projectId: string;
  id: string;
  values: CostInput;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <EditIconButton label="Edit cost" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={close} title="Edit cost">
        <Form projectId={projectId} close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
