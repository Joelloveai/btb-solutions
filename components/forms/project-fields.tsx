"use client";

import type { UseFormRegister } from "react-hook-form";
import { Field, Input, Select } from "@/components/ui/field";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/constants";
import type { ProjectInput } from "@/lib/validators";

/** Shared by the create and edit project forms. */
export function ProjectFields({
  register,
  errors,
  showStatus = false,
}: {
  register: UseFormRegister<ProjectInput>;
  errors: Partial<Record<keyof ProjectInput, { message?: string }>>;
  showStatus?: boolean;
}) {
  return (
    <>
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
      <Field label="Retention held on each claim (%)" error={errors.retentionPercent?.message}>
        <Input {...register("retentionPercent")} type="number" step="0.01" inputMode="decimal" />
      </Field>
      {showStatus ? (
        <Field label="Status">
          <Select {...register("status")}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <label className="flex min-h-12 items-center gap-3 text-base text-slate-800">
        <input type="checkbox" {...register("sstEnabled")} className="h-5 w-5 rounded border-slate-300 accent-brand" />
        Apply SST (6%)
      </label>
    </>
  );
}
