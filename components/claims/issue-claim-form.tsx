"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { issueClaim } from "@/app/actions";
import { useLocale } from "@/components/locale-provider";
import { useSubmit } from "@/components/forms/use-submit";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { computeClaim } from "@/lib/claims";
import { formatRM, todayInputValue } from "@/lib/format";
import { claimSchema, type ClaimInput } from "@/lib/validators";

function Form({
  projectId,
  retentionPercent,
  sstEnabled,
  sstRate,
  previousClaimed,
  claimableLeft,
  close,
}: {
  projectId: string;
  retentionPercent: number;
  sstEnabled: boolean;
  sstRate: number;
  previousClaimed: number;
  claimableLeft: number;
  close: () => void;
}) {
  const locale = useLocale();
  const { pending, submit } = useSubmit("Claim issued", close);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    defaultValues: { date: todayInputValue(), workDone: "" },
  });
  const workDone = useWatch({ control, name: "workDone" });
  const valid = /^\d+(\.\d{1,2})?$/.test(workDone ?? "");
  const figures = computeClaim({
    workDone: valid ? workDone : 0,
    retentionPercent,
    sstEnabled,
    sstRate,
    previousClaimed,
  });
  const money = (n: number) => formatRM(n, locale);

  return (
    <form onSubmit={handleSubmit((v) => submit(() => issueClaim(projectId, v)))} className="space-y-3">
      <Field label="Claim date" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="Work done this period (RM)" error={errors.workDone?.message}>
        <Input {...register("workDone")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      <p className="text-sm text-slate-600">Still claimable on this contract: {money(claimableLeft)}</p>
      <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
        {sstEnabled ? <Line label={`SST (${sstRate}%)`} value={money(figures.sstAmount)} /> : null}
        <Line label="Amount claimed" value={money(figures.amountClaimed)} />
        <Line label={`Retention held (${retentionPercent}%)`} value={`-${money(figures.retentionAmount)}`} />
        <Line label="Net claim" value={money(figures.netClaim)} strong />
      </dl>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Issuing…" : "Issue claim"}
      </Button>
    </form>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-slate-200 pt-1 font-bold" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function IssueClaimButton(props: Omit<Parameters<typeof Form>[0], "close">) {
  return (
    <ModalButton label="+ Issue Claim" title="Issue progress claim">
      {(close) => <Form {...props} close={close} />}
    </ModalButton>
  );
}
