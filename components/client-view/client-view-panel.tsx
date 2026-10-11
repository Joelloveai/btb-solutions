"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { createPaymentMilestone, deleteDailyLog, deletePaymentMilestone, deleteSelection, setProjectStage } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { useSubmit } from "@/components/forms/use-submit";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { PendingOps } from "@/components/offline/pending-ops";
import { shrink } from "@/components/photos/shrink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { PROJECT_STAGES, SELECTION_CATEGORIES } from "@/lib/constants";
import { todayInputValue } from "@/lib/format";
import { toStoredFile } from "@/lib/offline/files";
import { dailyLogSchema, milestoneSchema, selectionSchema, type DailyLogInput, type MilestoneInput, type SelectionInput } from "@/lib/validators";

export type MilestoneRow = { id: string; label: string; percent: number; amountText: string; paidText: string; status: "PAID" | "PART_PAID" | "OUTSTANDING"; overdue: boolean; dueText: string | null };
export type SelectionRow = { id: string; category: string; name: string; details: string | null; photoId: string | null; approvedText: string | null };
export type LogRow = { id: string; dateText: string; note: string };

const statusLabel = { PAID: "Paid", PART_PAID: "Part paid", OUTSTANDING: "Outstanding" } as const;
const statusTone = { PAID: "green", PART_PAID: "yellow", OUTSTANDING: "gray" } as const;

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-3 sm:p-4" role="region" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function StageSelect({ projectId, stage }: { projectId: string; stage: string }) {
  const { submit } = useSubmit("Stage updated", () => undefined);
  return (
    <Select aria-label="Current stage" value={stage} onChange={(e) => submit(() => setProjectStage(projectId, e.target.value))} className="max-w-xs">
      <option value="">Not started</option>
      {PROJECT_STAGES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </Select>
  );
}

function MilestoneForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useSubmit("Instalment added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MilestoneInput>({ resolver: zodResolver(milestoneSchema), defaultValues: { label: "", percent: "", dueDate: "" } });
  return (
    <form onSubmit={handleSubmit((v) => submit(() => createPaymentMilestone(projectId, v)))} className="space-y-3">
      <Field label="Instalment" error={errors.label?.message}>
        <Input {...register("label")} placeholder="e.g. Deposit" />
      </Field>
      <Field label="Percent of total" error={errors.percent?.message}>
        <Input {...register("percent")} type="number" step="0.01" inputMode="decimal" placeholder="10" />
      </Field>
      <Field label="Due date (optional)" error={errors.dueDate?.message}>
        <Input {...register("dueDate")} type="date" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save instalment"}
      </Button>
    </form>
  );
}

function SelectionForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useOfflineSubmit("Selection added", close);
  const photo = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SelectionInput>({ resolver: zodResolver(selectionSchema), defaultValues: { category: "Tiles", name: "", details: "" } });
  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        setPreparing(true);
        try {
          const stored = file ? await toStoredFile(await shrink(file), file.name) : undefined;
          submit({
            type: "createSelection",
            label: `Selection: ${v.name}`,
            projectId,
            payload: { input: v },
            file: stored,
            fields: stored ? { kind: "SELECTION", projectId, capturedAt: new Date(file?.lastModified || Date.now()).toISOString() } : undefined,
          });
        } finally {
          setPreparing(false);
        }
      })}
      className="space-y-3"
    >
      <Field label="Category" error={errors.category?.message}>
        <Select {...register("category")}>
          {SELECTION_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label="Product" error={errors.name?.message}>
        <Input {...register("name")} placeholder="e.g. Grey matt tile 600x600" />
      </Field>
      <Field label="Details (optional)" error={errors.details?.message}>
        <Input {...register("details")} placeholder="Supplier, colour code, size" />
      </Field>
      <input ref={photo} type="file" accept="image/*" className="sr-only" aria-label="Photo of the product" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button type="button" variant="secondary" className="w-full" onClick={() => photo.current?.click()}>
        <Camera className="h-4 w-4" aria-hidden="true" />
        {file ? "Change photo" : "Add a photo or swatch"}
      </Button>
      {file ? <p className="truncate text-sm text-muted-foreground">{file.name}</p> : null}
      <Button type="submit" className="w-full" disabled={pending || preparing}>
        {pending || preparing ? "Saving…" : "Save selection"}
      </Button>
    </form>
  );
}

function LogForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useOfflineSubmit("Daily log added", close);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DailyLogInput>({ resolver: zodResolver(dailyLogSchema), defaultValues: { date: todayInputValue(), note: "" } });
  return (
    <form onSubmit={handleSubmit((v) => submit({ type: "createDailyLog", label: `Daily log ${v.date}`, projectId, payload: { input: v } }))} className="space-y-3">
      <Field label="Day" error={errors.date?.message}>
        <Input {...register("date")} type="date" />
      </Field>
      <Field label="What happened on site" error={errors.note?.message}>
        <Input {...register("note")} placeholder="e.g. Kitchen tiling started; wiring inspected" />
      </Field>
      <p className="text-xs text-muted-foreground">The client can read this, with the photos taken that day.</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save daily log"}
      </Button>
    </form>
  );
}

/** Everything the client sees in their portal that the contractor prepares, in one place. */
export function ClientViewPanel({
  projectId,
  hasClient,
  stage,
  milestones,
  selections,
  logs,
}: {
  projectId: string;
  hasClient: boolean;
  stage: string;
  milestones: MilestoneRow[];
  selections: SelectionRow[];
  logs: LogRow[];
}) {
  const totalPercent = milestones.reduce((t, m) => t + m.percent, 0);
  return (
    <div className="space-y-4">
      {!hasClient ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Link this project to a client (Edit Project) to share any of this with them.</p> : null}

      <Section title="Project stage" hint="Shown to the client as where the job is up to.">
        <StageSelect projectId={projectId} stage={stage} />
      </Section>

      <Section title="Payment schedule" hint="The instalments you agreed with the client. Paid or not is worked out from the payments you record." action={<ModalButton label="+ Add instalment" title="Add instalment" variant="secondary">{(close) => <MilestoneForm projectId={projectId} close={close} />}</ModalButton>}>
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No schedule yet. Add instalments such as Deposit 10%, Framing 30%.</p>
        ) : (
          <>
            <ul className="divide-y rounded-lg border">
              {milestones.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2" data-testid="milestone-row">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {m.label} <span className="font-normal text-muted-foreground">({m.percent}%)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.amountText}
                      {m.dueText ? ` · due ${m.dueText}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.overdue ? <Badge tone="red">Overdue</Badge> : null}
                    <Badge tone={statusTone[m.status]}>{statusLabel[m.status]}</Badge>
                    <DeleteIconButton label={`Delete instalment ${m.label}`} message={`Remove "${m.label}" from the schedule?`} onConfirm={() => deletePaymentMilestone(m.id)} />
                  </div>
                </li>
              ))}
            </ul>
            <p className={`mt-2 text-xs ${Math.abs(totalPercent - 100) < 0.005 ? "text-profit" : "text-pending-dark"}`} data-testid="schedule-total">
              {Math.abs(totalPercent - 100) < 0.005 ? "Instalments add up to 100%." : `Instalments add up to ${Number(totalPercent.toFixed(2))}%, not 100%.`}
            </p>
          </>
        )}
      </Section>

      <Section title="Product selections" hint="Tiles, paint, fixtures. The client approves each one in their portal." action={<ModalButton label="+ Add selection" title="Add product selection" variant="secondary">{(close) => <SelectionForm projectId={projectId} close={close} />}</ModalButton>}>
        <PendingOps projectId={projectId} types={["createSelection"]} />
        {selections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing for the client to choose yet.</p>
        ) : (
          <ul className="space-y-2">
            {selections.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border p-2" data-testid="selection-row">
                {s.photoId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/photos/${s.photoId}`} alt={`Sample: ${s.name}`} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.category}
                    {s.details ? ` · ${s.details}` : ""}
                  </p>
                </div>
                {s.approvedText ? <Badge tone="green">{`Approved ${s.approvedText}`}</Badge> : <Badge tone="yellow">Awaiting client</Badge>}
                <DeleteIconButton label={`Delete selection ${s.name}`} message={`Delete "${s.name}"?`} onConfirm={() => deleteSelection(s.id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Daily log" hint="A short note for each day. The client reads it with that day's photos." action={<ModalButton label="+ Add daily log" title="Add daily log" variant="secondary">{(close) => <LogForm projectId={projectId} close={close} />}</ModalButton>}>
        <PendingOps projectId={projectId} types={["createDailyLog"]} />
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No daily logs yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {logs.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-2 px-3 py-2" data-testid="log-row">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">{l.dateText}</p>
                  <p className="text-sm">{l.note}</p>
                </div>
                <DeleteIconButton label="Delete daily log" message="Delete this daily log?" onConfirm={() => deleteDailyLog(l.id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
