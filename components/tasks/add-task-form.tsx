"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { createTask } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import type { Lookups } from "@/components/projects/lookups";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { todayInputValue } from "@/lib/format";
import { taskSchema, type TaskInput } from "@/lib/validators";

function Form({ projectId, lookups, close }: { projectId: string; lookups: Lookups; close: () => void }) {
  const { pending, submit } = useSubmit("Task added", close);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: { description: "", subcontractorId: "", startDate: "", dueDate: todayInputValue(), isMilestone: false },
  });
  const milestone = useWatch({ control, name: "isMilestone" });

  return (
    <form onSubmit={handleSubmit((v) => submit(() => createTask(projectId, v)))} className="space-y-3">
      <Field label="Task or milestone" error={errors.description?.message}>
        <Input {...register("description")} placeholder="e.g. Rewire kitchen" />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" {...register("isMilestone")} className="h-5 w-5 rounded border-input accent-primary" />
        This is a milestone (a single date on the client timeline)
      </label>
      {milestone ? null : (
        <>
          <Field label="Assign to subcontractor" error={errors.subcontractorId?.message}>
            <Select {...register("subcontractorId")}>
              <option value="">— Own crew —</option>
              {lookups.subcons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date (optional)" error={errors.startDate?.message}>
            <Input {...register("startDate")} type="date" />
          </Field>
        </>
      )}
      <Field label="Due date" error={errors.dueDate?.message}>
        <Input {...register("dueDate")} type="date" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save task"}
      </Button>
    </form>
  );
}

export function AddTaskForm({ projectId, lookups }: { projectId: string; lookups: Lookups }) {
  return (
    <ModalButton label="+ Add Task" title="Add task">
      {(close) => <Form projectId={projectId} lookups={lookups} close={close} />}
    </ModalButton>
  );
}
