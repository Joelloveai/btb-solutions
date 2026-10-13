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
  boqAmount,
  close,
}: {
  projectId: string;
  retentionPercent: number;
  sstEnabled: boolean;
  sstRate: number;
  previousClaimed: number;
  claimableLeft: number;
  /** Value of BOQ work done since the last claim (0 when no progress has been recorded). */
  boqAmount: number;
  close: () => void;
}) {
  const locale = useLocale();
  const { pending, submit } = useSubmit("Claim issued", close);
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    defaultValues: { date: todayInputValue(), workDone: "", periodFrom: "", periodTo: "", materialsOnSite: "", fromBoq: false },
  });
  const workDone = useWatch({ control, name: "workDone" });
  const fromBoq = useWatch({ control, name: "fromBoq" });
  const materials = useWatch({ control, name: "materialsOnSite" });
  const valid = /^\d+(\.\d{1,2})?$/.test(workDone ?? "");
  const materialsValue = /^\d+(\.\d{1,2})?$/.test(materials ?? "") ? Number(materials) : 0;
  const figures = computeClaim({
    workDone: (fromBoq ? boqAmount : valid ? Number(workDone) : 0) + materialsValue,
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
      {boqAmount > 0 ? (
        <Button
          type="button"
          variant={fromBoq ? "primary" : "secondary"}
          className="w-full"
          aria-pressed={!!fromBoq}
          onClick={() => {
            setValue("fromBoq", !fromBoq);
            if (!fromBoq) setValue("workDone", boqAmount.toFixed(2));
          }}
        >
          {fromBoq ? "Billing the BOQ progress (tap to type an amount instead)" : `Bill the BOQ progress: ${formatRM(boqAmount, locale)}`}
        </Button>
      ) : null}
      <Field label="Work done this period (RM)" error={errors.workDone?.message}>
        <Input {...register("workDone")} type="number" step="0.01" inputMode="decimal" readOnly={!!fromBoq} />
      </Field>
      <details className="group rounded-md border border-input">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          <span>More</span>
          <span className="text-muted-foreground group-open:hidden">period, materials on site</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <Field label="Period from" error={errors.periodFrom?.message}>
            <Input {...register("periodFrom")} type="date" />
          </Field>
          <Field label="Period to" error={errors.periodTo?.message}>
            <Input {...register("periodTo")} type="date" />
          </Field>
          <Field label="Materials on site, not yet used (RM)" error={errors.materialsOnSite?.message}>
            <Input {...register("materialsOnSite")} type="number" step="0.01" inputMode="decimal" />
          </Field>
        </div>
      </details>
      <p className="text-sm text-muted-foreground">Still claimable on this contract: {money(claimableLeft)}</p>
      <dl className="space-y-1 rounded-lg bg-muted p-3 text-sm">
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
    <div className={`flex justify-between ${strong ? "border-t border-border pt-1 font-bold" : ""}`}>
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
