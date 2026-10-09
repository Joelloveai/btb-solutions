"use client";

import { useWatch, type Control, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { ClientPicker } from "@/components/clients/client-picker";
import { Field, Input, Select } from "@/components/ui/field";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/constants";
import type { ProjectInput } from "@/lib/validators";

/** Shared by the create and edit project forms. */
export function ProjectFields({
  register,
  control,
  setValue,
  errors,
  showStatus = false,
}: {
  register: UseFormRegister<ProjectInput>;
  control: Control<ProjectInput>;
  setValue: UseFormSetValue<ProjectInput>;
  errors: Partial<Record<keyof ProjectInput, { message?: string }>>;
  showStatus?: boolean;
}) {
  const clientId = useWatch({ control, name: "clientId" }) ?? "";
  return (
    <>
      <Field label="Project name" error={errors.name?.message}>
        <Input {...register("name")} placeholder="e.g. Taman Sri Petaling Renovation" />
      </Field>
      <ClientPicker value={clientId} onChange={(id) => setValue("clientId", id)} />
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
