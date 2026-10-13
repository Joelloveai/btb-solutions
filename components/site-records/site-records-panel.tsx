"use client";

import { useState } from "react";
import { answerRfi, closeRfi, setInstructionStatus } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { PendingOps } from "@/components/offline/pending-ops";
import { useCan } from "@/components/permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";
import { VoiceInput } from "@/components/ui/voice-input";

export type InstructionRow = { id: string; number: string; issuedBy: string; issuedTo: string; description: string; status: string; issuedText: string; acknowledgedText: string | null; closedText: string | null };
export type RfiRow = { id: string; number: string; subject: string; question: string; raisedBy: string; assignedTo: string | null; response: string | null; status: string; raisedText: string; respondedText: string | null };

const tone = { OPEN: "yellow", ACKNOWLEDGED: "blue", ANSWERED: "blue", CLOSED: "green" } as const;
const label = { OPEN: "Open", ACKNOWLEDGED: "Acknowledged", ANSWERED: "Answered", CLOSED: "Closed" } as const;

function InstructionForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useOfflineSubmit("Instruction issued. It is on the timeline.", close);
  const [issuedTo, setIssuedTo] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!issuedTo.trim() || !description.trim()) return setError("Say who it is for and what to do.");
        setError("");
        submit({ type: "issueInstruction", projectId, label: `Instruction to ${issuedTo.trim()}`, payload: { input: { issuedTo, description } } });
      }}
    >
      <Field label="Who is it for?">
        <Input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="e.g. Ah Seng Electrical" />
      </Field>
      <Field label="What must be done?">
        <VoiceInput multiline value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Issue instruction"}
      </Button>
    </form>
  );
}

function RfiForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useOfflineSubmit("Question sent. It is on the timeline.", close);
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subject.trim() || !question.trim()) return setError("Give it a subject and write the question.");
        setError("");
        submit({ type: "raiseRfi", projectId, label: `RFI: ${subject.trim()}`, payload: { input: { subject, question, assignedTo } } });
      }}
    >
      <Field label="Subject">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Beam size at grid C3" />
      </Field>
      <Field label="Question">
        <VoiceInput multiline value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} />
      </Field>
      <Field label="Who should answer? (optional)">
        <Input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} placeholder="e.g. Engineer, Architect" />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Send question"}
      </Button>
    </form>
  );
}

function AnswerButton({ rfi }: { rfi: RfiRow }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const { pending, submit } = useSubmit("Answer saved", () => setOpen(false));
  return (
    <>
      <Button small variant="secondary" onClick={() => setOpen(true)}>
        Record answer
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Answer ${rfi.number}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(async () => {
              const r = await answerRfi(rfi.id, text);
              if (!r.ok) setError(r.error);
              return r;
            });
          }}
        >
          <p className="text-sm text-muted-foreground">{rfi.question}</p>
          <Field label="Answer" error={error}>
            <VoiceInput multiline value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save answer"}
          </Button>
        </form>
      </Modal>
    </>
  );
}

function StepButton({ text, run, done }: { text: string; run: () => ReturnType<typeof closeRfi>; done: string }) {
  const { pending, submit } = useSubmit(done, () => {});
  return (
    <Button small variant="secondary" disabled={pending} onClick={() => submit(run)}>
      {text}
    </Button>
  );
}

/** Written instructions and questions on site. Each is numbered, kept, and on the project timeline. */
export function SiteRecordsPanel({ projectId, instructions, rfis }: { projectId: string; instructions: InstructionRow[]; rfis: RfiRow[] }) {
  const allowed = useCan();
  const write = allowed("field.write");
  return (
    <section aria-label="Site records" className="space-y-8">
      <PendingOps projectId={projectId} types={["issueInstruction", "raiseRfi"]} />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Site instructions</h3>
          <ModalButton requires="field.write" label="+ Issue Instruction" title="Issue site instruction">
            {(close) => <InstructionForm projectId={projectId} close={close} />}
          </ModalButton>
        </div>
        {instructions.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No instructions yet.</p> : null}
        <ul className="space-y-2">
          {instructions.map((i) => (
            <li key={i.id}>
              <Card className="space-y-1 p-3" data-testid="instruction">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {i.number} <span className="font-normal text-muted-foreground">for {i.issuedTo}</span>
                  </p>
                  <Badge tone={tone[i.status as keyof typeof tone] ?? "gray"}>{label[i.status as keyof typeof label] ?? i.status}</Badge>
                </div>
                <p className="text-sm">{i.description}</p>
                <p className="text-xs text-muted-foreground">
                  Issued by {i.issuedBy}, {i.issuedText}
                  {i.acknowledgedText ? ` · acknowledged ${i.acknowledgedText}` : ""}
                  {i.closedText ? ` · closed ${i.closedText}` : ""}
                </p>
                {write && i.status !== "CLOSED" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {i.status === "OPEN" ? <StepButton text="Acknowledged" done="Marked as acknowledged" run={() => setInstructionStatus(i.id, "ACKNOWLEDGED")} /> : null}
                    <StepButton text="Close" done="Instruction closed" run={() => setInstructionStatus(i.id, "CLOSED")} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Requests for information (RFI)</h3>
          <ModalButton requires="field.write" label="+ Raise RFI" title="Raise RFI">
            {(close) => <RfiForm projectId={projectId} close={close} />}
          </ModalButton>
        </div>
        {rfis.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No RFIs yet. Use one when you need an answer from the engineer, architect or client.</p> : null}
        <ul className="space-y-2">
          {rfis.map((r) => (
            <li key={r.id}>
              <Card className="space-y-1 p-3" data-testid="rfi">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {r.number}: {r.subject}
                  </p>
                  <Badge tone={tone[r.status as keyof typeof tone] ?? "gray"}>{label[r.status as keyof typeof label] ?? r.status}</Badge>
                </div>
                <p className="text-sm">{r.question}</p>
                {r.response ? (
                  <p className="rounded-lg bg-muted p-2 text-sm" data-testid="rfi-response">
                    <span className="font-medium">Answer:</span> {r.response}
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Raised by {r.raisedBy}, {r.raisedText}
                  {r.assignedTo ? ` · for ${r.assignedTo}` : ""}
                  {r.respondedText ? ` · answered ${r.respondedText}` : ""}
                </p>
                {write && r.status !== "CLOSED" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.status === "OPEN" ? <AnswerButton rfi={r} /> : null}
                    <StepButton text="Close" done="RFI closed" run={() => closeRfi(r.id)} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
