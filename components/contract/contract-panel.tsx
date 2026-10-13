"use client";

import clsx from "clsx";
import { Check, Flag } from "lucide-react";
import { useState } from "react";
import { assignTeamMember, completeMilestone, createMilestone, deleteMilestone, removeTeamMember, updateContractDetails } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { useCan } from "@/components/permissions-provider";
import { CIDB_GRADES, CONTRACT_TYPES, CONTRACT_TYPE_LABELS, MILESTONE_STATUS_LABELS, PROJECT_TYPES, PROJECT_TYPE_LABELS, TEAM_ROLES, TEAM_ROLE_LABELS } from "@/lib/constants";
import type { ContractDetailsInput } from "@/lib/validators";

export type MilestoneRow = {
  id: string;
  name: string;
  description: string | null;
  dueText: string;
  completedText: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
  weightage: string;
  paymentTrigger: boolean;
  paymentText: string | null;
};
export type TeamRow = { id: string; name: string; role: string };
export type ContractView = {
  details: ContractDetailsInput;
  /** Shown as read-only facts alongside the editable particulars. */
  startText: string | null;
  endText: string | null;
  retentionPercent: string;
};

const dot = { COMPLETED: "bg-profit text-white", DELAYED: "bg-loss text-white", IN_PROGRESS: "bg-accent text-white", PENDING: "bg-muted text-muted-foreground" } as const;
const tone = { COMPLETED: "green", DELAYED: "red", IN_PROGRESS: "yellow", PENDING: "gray" } as const;

function DetailsForm({ projectId, values, close }: { projectId: string; values: ContractDetailsInput; close: () => void }) {
  const [v, setV] = useState(values);
  const { pending, submit } = useSubmit("Contract details saved", close);
  const [error, setError] = useState("");
  const set = (k: keyof ContractDetailsInput) => (e: { target: { value: string } }) => setV((cur) => ({ ...cur, [k]: e.target.value }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        submit(async () => {
          const result = await updateContractDetails(projectId, v);
          if (!result.ok) setError(result.error);
          return result;
        });
      }}
    >
      <Field label="Project type">
        <Select value={v.projectType ?? ""} onChange={set("projectType")}>
          <option value="">Choose…</option>
          {PROJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROJECT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Contract type">
        <Select value={v.contractType ?? ""} onChange={set("contractType")}>
          <option value="">Choose…</option>
          {CONTRACT_TYPES.map((t) => (
            <option key={t} value={t}>
              {CONTRACT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Site address">
        <Textarea value={v.siteAddress ?? ""} onChange={set("siteAddress")} rows={2} maxLength={300} />
      </Field>
      <Field label="Contract end date">
        <Input type="date" value={v.contractEndDate ?? ""} onChange={set("contractEndDate")} />
      </Field>
      <details className="group rounded-md border border-input">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium">
          <span>More</span>
          <span className="text-muted-foreground group-open:hidden">CIDB, consultants, bond, GPS</span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <Field label="CIDB grade">
            <Select value={v.cidbGrade ?? ""} onChange={set("cidbGrade")}>
              <option value="">Choose…</option>
              {CIDB_GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </Field>
          <Field label="CIDB project reference">
            <Input value={v.cidbProjectRef ?? ""} onChange={set("cidbProjectRef")} />
          </Field>
          <Field label="Architect">
            <Input value={v.architectName ?? ""} onChange={set("architectName")} />
          </Field>
          <Field label="Engineer">
            <Input value={v.engineerName ?? ""} onChange={set("engineerName")} />
          </Field>
          <Field label="Consultant">
            <Input value={v.consultantName ?? ""} onChange={set("consultantName")} />
          </Field>
          <Field label="Site latitude (for weather)">
            <Input inputMode="decimal" value={v.siteLatitude ?? ""} onChange={set("siteLatitude")} placeholder="3.1390" />
          </Field>
          <Field label="Site longitude (for weather)">
            <Input inputMode="decimal" value={v.siteLongitude ?? ""} onChange={set("siteLongitude")} placeholder="101.6869" />
          </Field>
          <Field label="Defects liability period (days)">
            <Input inputMode="numeric" value={v.defectsLiabilityPeriodDays} onChange={set("defectsLiabilityPeriodDays")} />
          </Field>
          <Field label="Retention released at completion (%)">
            <Input inputMode="decimal" value={v.retentionReleasePercent ?? ""} onChange={set("retentionReleasePercent")} />
          </Field>
          <Field label="Performance bond (%)">
            <Input inputMode="decimal" value={v.performanceBondPercent ?? ""} onChange={set("performanceBondPercent")} />
          </Field>
          <Field label="SST rate (%)">
            <Input inputMode="decimal" value={v.sstRate ?? ""} onChange={set("sstRate")} />
          </Field>
        </div>
      </details>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save contract details"}
      </Button>
    </form>
  );
}

function MilestoneForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useSubmit("Milestone added", close);
  const [v, setV] = useState({ name: "", description: "", dueDate: "", weightagePercent: "10", paymentTrigger: false, paymentAmount: "" });
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        submit(async () => {
          const result = await createMilestone(projectId, v);
          if (!result.ok) setError(result.error);
          return result;
        });
      }}
    >
      <Field label="Milestone">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Slab poured" required />
      </Field>
      <Field label="Due date">
        <Input type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} required />
      </Field>
      <Field label="Share of the job (%)">
        <Input inputMode="decimal" value={v.weightagePercent} onChange={(e) => setV({ ...v, weightagePercent: e.target.value })} />
      </Field>
      <label className="flex min-h-12 items-center gap-3 text-base">
        <input type="checkbox" className="h-5 w-5" checked={v.paymentTrigger} onChange={(e) => setV({ ...v, paymentTrigger: e.target.checked })} />
        Reaching it triggers a payment claim
      </label>
      {v.paymentTrigger ? (
        <Field label="Payment amount (RM)">
          <Input inputMode="decimal" value={v.paymentAmount} onChange={(e) => setV({ ...v, paymentAmount: e.target.value })} />
        </Field>
      ) : null}
      <Field label="Notes (optional)">
        <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} rows={2} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save milestone"}
      </Button>
    </form>
  );
}

function TeamForm({ projectId, people, close }: { projectId: string; people: { id: string; name: string }[]; close: () => void }) {
  const { pending, submit } = useSubmit("Added to the team", close);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<string>("SITE_SUPERVISOR");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => assignTeamMember(projectId, userId, role));
      }}
    >
      <Field label="Person">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} required>
          <option value="">Choose…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Role on this project">
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          {TEAM_ROLES.map((r) => (
            <option key={r} value={r}>
              {TEAM_ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" className="w-full" disabled={pending || !userId}>
        {pending ? "Saving…" : "Add to team"}
      </Button>
    </form>
  );
}

function CompleteButton({ id }: { id: string }) {
  const { pending, submit } = useSubmit("Milestone reached", () => {});
  return (
    <Button small variant="secondary" disabled={pending} onClick={() => submit(() => completeMilestone(id))}>
      <Check className="h-4 w-4" aria-hidden="true" /> Mark done
    </Button>
  );
}

export function ContractPanel({
  projectId,
  view,
  details,
  milestones,
  progress,
  team,
  people,
}: {
  projectId: string;
  view: { facts: [string, string][] };
  details: ContractDetailsInput;
  milestones: MilestoneRow[];
  progress: number | null;
  team: TeamRow[];
  people: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const allowed = useCan();
  const remove = useSubmit("Removed", () => {});
  return (
    <section aria-label="Contract" className="space-y-6">
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Contract details</h3>
          {allowed("money.write") ? (
            <Button small variant="secondary" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm" data-testid="contract-facts">
          {view.facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value || "—"}</dd>
            </div>
          ))}
        </dl>
        <Modal open={editing} onClose={() => setEditing(false)} title="Contract details">
          {editing ? <DetailsForm projectId={projectId} values={details} close={() => setEditing(false)} /> : null}
        </Modal>
      </Card>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">
            Milestones {progress !== null ? <span className="font-normal text-muted-foreground" data-testid="milestone-progress">· {progress}% of the job done</span> : null}
          </h3>
          <ModalButton label="+ Add Milestone" title="Add milestone">
            {(close) => <MilestoneForm projectId={projectId} close={close} />}
          </ModalButton>
        </div>
        {milestones.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No milestones yet. Add the main stages of the job and when each is due.</p> : null}
        <ol className="relative space-y-4 border-l-2 border-muted pl-6" data-testid="milestone-timeline">
          {milestones.map((m) => (
            <li key={m.id} data-testid="milestone" data-status={m.status} className="relative">
              <span className={clsx("absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full", dot[m.status])} aria-hidden="true">
                {m.status === "COMPLETED" ? <Check className="h-4 w-4" /> : <Flag className="h-3.5 w-3.5" />}
              </span>
              <Card className="space-y-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{m.name}</p>
                  <Badge tone={tone[m.status]}>{MILESTONE_STATUS_LABELS[m.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {m.completedText ? `Reached ${m.completedText}` : `Due ${m.dueText}`} · {m.weightage}% of the job
                </p>
                {m.description ? <p className="text-sm">{m.description}</p> : null}
                {m.paymentTrigger ? <p className="text-sm font-medium text-pending-dark">Triggers a payment claim{m.paymentText ? `: ${m.paymentText}` : ""}</p> : null}
                {allowed("money.write") ? (
                  <div className="flex items-center gap-2 pt-1">
                    {m.status !== "COMPLETED" ? <CompleteButton id={m.id} /> : null}
                    <DeleteIconButton label={`Delete milestone ${m.name}`} message={`Delete the milestone "${m.name}"? It stays in the project timeline.`} onConfirm={() => deleteMilestone(m.id)} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Project team</h3>
          <ModalButton label="+ Add Team Member" title="Add team member">
            {(close) => <TeamForm projectId={projectId} people={people} close={close} />}
          </ModalButton>
        </div>
        {team.length === 0 ? <p className="text-sm text-muted-foreground">No one assigned yet.</p> : null}
        <ul className="space-y-2" data-testid="team">
          {team.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3">
              <span>
                <span className="font-medium">{t.name}</span> <span className="text-sm text-muted-foreground">· {t.role}</span>
              </span>
              {allowed("money.write") ? (
                <Button small variant="ghost" disabled={remove.pending} onClick={() => remove.submit(() => removeTeamMember(t.id))}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
