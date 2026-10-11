"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { ModalButton } from "@/components/ui/modal";
import { projectSchema, type ProjectInput } from "@/lib/validators";
import { ProjectFields } from "./project-fields";
import { useSubmit } from "./use-submit";

function Form({ close }: { close: () => void }) {
  const { pending, submit } = useSubmit("Project created", close);
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", clientId: "", contractValue: "", contractRef: "", startDate: "", sstEnabled: false, retentionPercent: "5.00" },
  });

  return (
    <form onSubmit={handleSubmit((values) => submit(() => createProject(values)))} className="space-y-3">
      <ProjectFields register={register} control={control} setValue={setValue} errors={errors} />
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
