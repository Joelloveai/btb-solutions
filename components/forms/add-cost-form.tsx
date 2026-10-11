"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { Lookups } from "@/components/projects/lookups";
import { updateCost } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
import { Modal, ModalButton } from "@/components/ui/modal";
import { useCallback, useState } from "react";
import { EditIconButton } from "./row-actions";
import { CATEGORY_LABELS, COST_CATEGORIES } from "@/lib/constants";
import { todayInputValue } from "@/lib/format";
import { costSchema, type CostInput } from "@/lib/validators";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { useSubmit } from "./use-submit";

export function CostFormBody({
  projectId,
  lookups,
  close,
  editing,
}: {
  projectId: string;
  lookups: Lookups;
  close: () => void;
  editing?: { id: string; values: CostInput };
}) {
  const update = useSubmit("Cost updated", close);
  const add = useOfflineSubmit("Cost added", close);
  const pending = editing ? update.pending : add.pending;
  const {
    register,
    control,
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
      subcontractorId: "",
      boqLineId: "",
    },
  });
  const category = useWatch({ control, name: "category" });

  return (
    <form onSubmit={handleSubmit((values) =>
      editing
        ? update.submit(() => updateCost(editing.id, values))
        : (!values.reference?.trim() && toast.message("Add invoice reference to strengthen this as evidence.", { description: "Open “More” on the next cost to add one." }),
          add.submit({ type: "addCost", projectId, label: `Cost: RM ${values.amount} · ${values.description}`, payload: { input: values } })),
    )} className="space-y-3">
      <Field label="Amount (RM)" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" autoFocus />
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
        <VoiceInput {...register("description")} placeholder="e.g. Cement 50 bags" />
      </Field>
      {category === "SUBCON" ? (
        <Field label="Subcontractor" error={errors.subcontractorId?.message}>
          <Select {...register("subcontractorId")}>
            <option value="">— Not linked —</option>
            {lookups.subcons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <details className="group rounded-md border border-input" open={Boolean(editing)}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          <span>More</span>
          <span className="text-muted-foreground group-open:hidden">date, vendor, reference</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <Field label="Date" error={errors.date?.message}>
            <Input {...register("date")} type="date" />
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
          <Field label="Vendor (optional)" error={errors.vendor?.message}>
            <Input {...register("vendor")} />
          </Field>
          <Field label="Reference (optional)" error={errors.reference?.message}>
            <Input {...register("reference")} />
          </Field>
        </div>
      </details>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save cost"}
      </Button>
    </form>
  );
}

export function AddCostForm({ projectId, lookups }: { projectId: string; lookups: Lookups }) {
  return (
    <ModalButton label="+ Add Cost" title="Add cost">
      {(close) => <CostFormBody projectId={projectId} lookups={lookups} close={close} />}
    </ModalButton>
  );
}

export function EditCostButton({
  projectId,
  lookups,
  id,
  values,
}: {
  projectId: string;
  lookups: Lookups;
  id: string;
  values: CostInput;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <EditIconButton label="Edit cost" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={close} title="Edit cost">
        <CostFormBody projectId={projectId} lookups={lookups} close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
