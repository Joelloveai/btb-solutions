"use client";

import { useState } from "react";
import { createBoqSection, deleteBoqSection, updateBoqProgress } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal, ModalButton } from "@/components/ui/modal";

export function AddSectionButton({ projectId }: { projectId: string }) {
  return (
    <ModalButton label="+ Add Section" title="Add BOQ section" variant="secondary">
      {(close) => <SectionForm projectId={projectId} close={close} />}
    </ModalButton>
  );
}

function SectionForm({ projectId, close }: { projectId: string; close: () => void }) {
  const { pending, submit } = useSubmit("Section added", close);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit(async () => {
          const r = await createBoqSection(projectId, { name });
          if (!r.ok) setError(r.error);
          return r;
        });
      }}
    >
      <Field label="Section name" error={error}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Substructure" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save section"}
      </Button>
    </form>
  );
}

export function DeleteSectionButton({ id, name }: { id: string; name: string }) {
  return <DeleteIconButton label={`Delete section ${name}`} message={`Delete the section "${name}"? Its items stay in the BOQ, just without a heading.`} onConfirm={() => deleteBoqSection(id)} />;
}

/** "How much of this item is done?" The claim form can then bill the difference since the last claim. */
export function ProgressButton({ id, description, unit, qty, completed, claimed }: { id: string; description: string; unit: string; qty: string; completed: string; claimed: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(completed);
  const [error, setError] = useState("");
  const { pending, submit } = useSubmit("Progress saved", () => setOpen(false));
  return (
    <>
      <Button small variant="secondary" onClick={() => (setValue(completed), setError(""), setOpen(true))} aria-label={`Update progress: ${description}`}>
        Update progress
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Update progress">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            submit(async () => {
              const r = await updateBoqProgress(id, value);
              if (!r.ok) setError(r.error);
              return r;
            });
          }}
        >
          <p className="text-sm text-muted-foreground">
            {description}: {qty} {unit} in the contract. {Number(claimed) > 0 ? `${claimed} ${unit} already claimed.` : ""}
          </p>
          <Field label={`Done so far (${unit})`} error={error}>
            <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save progress"}
          </Button>
        </form>
      </Modal>
    </>
  );
}
