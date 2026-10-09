"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { createSubcontractor, updateSubcontractor } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { subcontractorSchema, type SubcontractorInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({ close, editing }: { close: () => void; editing?: { id: string; values: SubcontractorInput } }) {
  const { pending, submit } = useSubmit(editing ? "Subcontractor updated" : "Subcontractor added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubcontractorInput>({
    resolver: zodResolver(subcontractorSchema),
    defaultValues: editing?.values ?? { name: "", contact: "", trade: "", bank: "" },
  });
  return (
    <form
      onSubmit={handleSubmit((v) => submit(() => (editing ? updateSubcontractor(editing.id, v) : createSubcontractor(v))))}
      className="space-y-3"
    >
      <Field label="Name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="e.g. Ah Seng Electrical" />
      </Field>
      <Field label="Contact (phone)" error={errors.contact?.message}>
        <Input {...register("contact")} type="tel" />
      </Field>
      <Field label="Trade" error={errors.trade?.message}>
        <Input {...register("trade")} placeholder="e.g. Electrical" />
      </Field>
      <Field label="Bank (name and account no.)" error={errors.bank?.message}>
        <Input {...register("bank")} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save subcontractor"}
      </Button>
    </form>
  );
}

export function AddSubcontractorForm() {
  return (
    <ModalButton label="+ New Subcontractor" title="New subcontractor">
      {(close) => <Form close={close} />}
    </ModalButton>
  );
}

export function EditSubcontractorButton({ id, values }: { id: string; values: SubcontractorInput }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button variant="secondary" small onClick={() => setOpen(true)}>
        Edit Subcontractor
      </Button>
      <Modal open={open} onClose={close} title="Edit subcontractor">
        <Form close={close} editing={{ id, values }} />
      </Modal>
    </>
  );
}
