"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { addBoqLine, updateBoqLine } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
import { Modal, ModalButton } from "@/components/ui/modal";
import { boqLineSchema, type BoqLineInput } from "@/lib/validators";
import { EditIconButton } from "./row-actions";
import { useSubmit } from "./use-submit";

function Form({
  projectId,
  close,
  editing,
}: {
  projectId: string;
  close: () => void;
  editing?: { id: string; values: BoqLineInput };
}) {
  const { pending, submit } = useSubmit(editing ? "BOQ line updated" : "BOQ line added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BoqLineInput>({
    resolver: zodResolver(boqLineSchema),
    defaultValues: editing?.values ?? { description: "", qty: "1", unit: "lot", rate: "" },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => submit(() => (editing ? updateBoqLine(editing.id, v) : addBoqLine(projectId, v))))}
      className="space-y-3"
    >
      <Field label="Description" error={errors.description?.message}>
        <VoiceInput {...register("description")} placeholder="e.g. Floor tiling" />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Qty" error={errors.qty?.message}>
          <Input {...register("qty")} type="number" step="0.001" inputMode="decimal" />
        </Field>
        <Field label="Unit" error={errors.unit?.message}>
          <Input {...register("unit")} />
        </Field>
        <Field label="Rate (RM)" error={errors.rate?.message}>
          <Input {...register("rate")} type="number" step="0.01" inputMode="decimal" />
        </Field>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save BOQ line"}
      </Button>
    </form>
  );
}

export function AddBoqLineForm({ projectId }: { projectId: string }) {
  return (
    <ModalButton label="+ Add BOQ Line" title="Add BOQ line">
      {(close) => <Form projectId={projectId} close={close} />}
    </ModalButton>
  );
}

export function EditBoqLineButton({ projectId, id, values }: { projectId: string; id: string; values: BoqLineInput }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <EditIconButton label="Edit BOQ line" onClick={() => setOpen(true)} />
      <Modal open={open} onClose={close} title="Edit BOQ line">
        <Form projectId={projectId} close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
