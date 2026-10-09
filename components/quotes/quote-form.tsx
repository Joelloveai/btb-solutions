"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createQuote, updateQuote } from "@/app/actions";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS } from "@/lib/constants";
import { formatRM, todayInputValue } from "@/lib/format";
import { calculateQuote } from "@/lib/quotes";
import { quoteSchema, type QuoteInput } from "@/lib/validators";

const emptyLine = { description: "", qty: "1", unit: "lot", unitPrice: "" };

export function QuoteForm({ quoteId, values }: { quoteId?: string; values?: QuoteInput }) {
  const router = useRouter();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<QuoteInput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: values ?? {
      clientName: "",
      title: "",
      date: todayInputValue(),
      sstEnabled: false,
      status: "DRAFT",
      notes: "",
      lines: [emptyLine],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const sstEnabled = useWatch({ control, name: "sstEnabled" });
  const totals = calculateQuote(
    (lines ?? []).map((l) => ({
      qty: /^\d+(\.\d+)?$/.test(l?.qty ?? "") ? l.qty : 0,
      unitPrice: /^\d+(\.\d+)?$/.test(l?.unitPrice ?? "") ? l.unitPrice : 0,
    })),
    !!sstEnabled,
  );
  const money = (n: number) => formatRM(n, locale);

  const onSubmit = handleSubmit((input) => {
    startTransition(async () => {
      const result = quoteId ? await updateQuote(quoteId, input) : await createQuote(input);
      if (result.ok && result.data) {
        toast.success("Quote saved");
        router.push(`/quotes/${result.data.id}`);
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <Field label="Client name" error={errors.clientName?.message}>
          <Input {...register("clientName")} />
        </Field>
        <Field label="Project title" error={errors.title?.message}>
          <Input {...register("title")} placeholder="e.g. Double-storey renovation" />
        </Field>
        <Field label="Quote date" error={errors.date?.message}>
          <Input {...register("date")} type="date" />
        </Field>
        <Field label="Status">
          <Select {...register("status")}>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex min-h-12 items-center gap-3 text-base text-slate-800">
          <input type="checkbox" {...register("sstEnabled")} className="h-5 w-5 rounded border-slate-300 accent-brand" />
          Apply SST (6%)
        </label>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => {
          const amount = totals.lineAmounts[index] ?? 0;
          const lineErrors = errors.lines?.[index];
          return (
            <div key={field.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <Field label="Description" error={lineErrors?.description?.message}>
                <Input {...register(`lines.${index}.description`)} placeholder="e.g. Supply and lay floor tiles" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Qty" error={lineErrors?.qty?.message}>
                  <Input {...register(`lines.${index}.qty`)} type="number" step="0.001" inputMode="decimal" />
                </Field>
                <Field label="Unit" error={lineErrors?.unit?.message}>
                  <Input {...register(`lines.${index}.unit`)} placeholder="m2" />
                </Field>
                <Field label="Unit price (RM)" error={lineErrors?.unitPrice?.message}>
                  <Input {...register(`lines.${index}.unitPrice`)} type="number" step="0.01" inputMode="decimal" />
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">
                  Amount <span className="font-semibold text-slate-900">{money(amount)}</span>
                </p>
                {fields.length > 1 ? (
                  <Button type="button" variant="ghost" small onClick={() => remove(index)}>
                    Remove line
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
        {errors.lines?.message ? <p className="text-sm text-loss">{errors.lines.message}</p> : null}
        <Button type="button" variant="secondary" className="w-full" onClick={() => append(emptyLine)}>
          + Add line
        </Button>
      </div>

      <Field label="Notes / terms (optional)" error={errors.notes?.message}>
        <textarea
          {...register("notes")}
          rows={3}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </Field>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Row label="Subtotal" value={money(totals.subtotal)} />
        {sstEnabled ? <Row label="SST (6%)" value={money(totals.sst)} /> : null}
        <Row label="Total" value={money(totals.total)} strong />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save Quote"}
      </Button>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "border-t border-slate-200 pt-2 text-lg font-bold" : "text-slate-700"}`}>
      <span>{label}</span>
      <span data-testid={`quote-${label.toLowerCase().split(" ")[0]}`}>{value}</span>
    </div>
  );
}
