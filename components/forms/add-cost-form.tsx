"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { addCost } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { CATEGORY_LABELS, COST_CATEGORIES } from "@/lib/constants";
import { todayInputValue } from "@/lib/format";
import { costSchema, type CostInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useSubmit("Cost added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CostInput>({
    resolver: zodResolver(costSchema),
    defaultValues: {
      date: todayInputValue(),
      category: "MATERIAL",
      description: "",
      amount: "",
      vendor: "",
      reference: "",
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => addCost(projectId, values)))} className="space-y-3">
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
