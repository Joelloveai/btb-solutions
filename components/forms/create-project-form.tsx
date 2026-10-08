"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { projectSchema, type ProjectInput } from "@/lib/validators";
import { useSubmit } from "./use-submit";

function Form({ close }: { close: () => void }) {
  const { pending, submit } = useSubmit("Project created", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", clientName: "", contractValue: "", startDate: "" },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => createProject(values)))} className="space-y-3">
      <Field label="Project name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="e.g. Taman Sri Petaling Renovation" />
      </Field>
      <Field label="Client (optional)" error={errors.clientName?.message}>
        <Input {...register("clientName")} />
      </Field>
      <Field label="Contract value (RM)" error={errors.contractValue?.message}>
        <Input {...register("contractValue")} type="number" step="0.01" inputMode="decimal" placeholder="150000" />
      </Field>
      <Field label="Start date (optional)" error={errors.startDate?.message}>
        <Input {...register("startDate")} type="date" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Create project"}
      </Button>
    </form>
  );
}

export function CreateProjectForm() {
  return (
    <ModalButton label="+ New Project" title="New project">
      {(close) => <Form close={close} />}
    </ModalButton>
  );
}
