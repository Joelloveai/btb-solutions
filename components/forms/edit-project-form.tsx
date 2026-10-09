"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { updateProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { projectSchema, type ProjectInput } from "@/lib/validators";
import { ProjectFields } from "./project-fields";
import { useSubmit } from "./use-submit";

function Form({ id, values, close }: { id: string; values: ProjectInput; close: () => void }) {
  const { pending, submit } = useSubmit("Project updated", close);
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInput>({ resolver: zodResolver(projectSchema), defaultValues: values });

  return (
    <form onSubmit={handleSubmit((v) => submit(() => updateProject(id, v)))} className="space-y-3">
      <ProjectFields register={register} control={control} setValue={setValue} errors={errors} showStatus />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save project"}
      </Button>
    </form>
  );
}

export function EditProjectButton({ id, values }: { id: string; values: ProjectInput }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button variant="secondary" small onClick={() => setOpen(true)}>
        Edit Project
      </Button>
      <Modal open={open} onClose={close} title="Edit project">
        <Form id={id} values={values} close={close} />
      </Modal>
    </>
  );
}
