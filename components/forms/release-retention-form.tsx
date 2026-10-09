"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { releaseRetention } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { todayInputValue } from "@/lib/format";
import { releaseRetentionSchema } from "@/lib/validators";
import { useSubmit } from "./use-submit";

type Values = { date: string; amount: string };

function Form({ projectId, outstanding, close }: { projectId: string; outstanding: number; close: () => void }) {
  const { pending, submit } = useSubmit("Retention released", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(releaseRetentionSchema),
    defaultValues: { date: todayInputValue(), amount: outstanding.toFixed(2) },
  });
  return (
    <form onSubmit={handleSubmit((v) => submit(() => releaseRetention(projectId, v)))} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Record the retention money the client has paid. It is added to this project&apos;s payments.
      </p>
      <Field label="Date received" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Amount released (RM)" error={errors.amount?.message}>
        <Input {...register("amount")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Confirm release"}
      </Button>
    </form>
  );
}

export function ReleaseRetentionButton({ projectId, outstanding }: { projectId: string; outstanding: number }) {
  return (
    <ModalButton label="Release Retention" title="Release retention">
      {(close) => <Form projectId={projectId} outstanding={outstanding} close={close} />}
    </ModalButton>
  );
}
