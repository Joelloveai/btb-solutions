"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal";
import { DOCUMENT_TYPES, PHOTO_TRADES } from "@/lib/constants";
import { MAX_DOCUMENT_BYTES, documentNameKey } from "@/lib/document-files";
import { toStoredFile } from "@/lib/offline/files";

export type DocumentDefaults = { name?: string; type?: string; trade?: string };
type Existing = { nameKey: string; name: string; version: number };

function Form({ projectId, defaults, existing, close }: { projectId: string; defaults?: DocumentDefaults; existing: Existing[]; close: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(defaults?.name ?? "");
  const [type, setType] = useState(defaults?.type ?? "Drawing");
  const [trade, setTrade] = useState(defaults?.trade ?? "");
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const { pending, submit } = useOfflineSubmit("Document uploaded", close);

  const match = existing.find((d) => d.nameKey === documentNameKey(name));

  const choose = (picked: File | null) => {
    setFile(picked);
    setProblem(picked && picked.size > MAX_DOCUMENT_BYTES ? "That file is over the 25 MB limit." : null);
    // Start from the file's own name so the common case needs no typing.
    if (picked && !name) setName(picked.name.replace(/\.[^.]+$/, ""));
  };

  const upload = async () => {
    if (!file) return setProblem("Choose a file first.");
    if (!name.trim()) return setProblem("Give the document a name.");
    if (file.size > MAX_DOCUMENT_BYTES) return;
    setPreparing(true);
    try {
      submit({
        type: "uploadDocument",
        label: `Document: ${name.trim()}${match ? ` (new version ${match.version + 1})` : ""}`,
        projectId,
        payload: {},
        file: await toStoredFile(file, file.name),
        fields: { projectId, name: name.trim(), type, trade, note },
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.docx,.xlsx" className="sr-only" aria-label="Document file" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      <Button type="button" variant="secondary" className="w-full" onClick={() => input.current?.click()}>
        <FileUp className="h-4 w-4" aria-hidden="true" />
        {file ? "Choose another file" : "Choose a file"}
      </Button>
      {file ? <p className="truncate text-sm text-muted-foreground">{file.name}</p> : null}
      <Field label="Document name">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Ground floor plan" />
      </Field>
      {match ? (
        <p className="rounded-md bg-pending-light px-3 py-2 text-sm text-pending-dark" data-testid="version-hint">
          This will be version {match.version + 1} of &ldquo;{match.name}&rdquo;. The earlier versions are kept.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="For trade">
          <Select value={trade} onChange={(e) => setTrade(e.target.value)}>
            <option value="">All trades</option>
            {PHOTO_TRADES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="What changed (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Rev B: kitchen wall moved 300 mm" />
      </Field>
      {problem ? <p className="text-sm font-medium text-destructive">{problem}</p> : null}
      <Button type="button" className="w-full" onClick={upload} disabled={pending || preparing}>
        {pending || preparing ? "Uploading…" : match ? `Upload as version ${match.version + 1}` : "Upload document"}
      </Button>
    </div>
  );
}

export function UploadDocumentForm({ projectId, existing, defaults, label = "+ Upload Document", title = "Upload document", variant = "primary" }: { projectId: string; existing: Existing[]; defaults?: DocumentDefaults; label?: string; title?: string; variant?: "primary" | "secondary" }) {
  return (
    <ModalButton label={label} title={title} variant={variant}>
      {(close) => <Form projectId={projectId} existing={existing} defaults={defaults} close={close} />}
    </ModalButton>
  );
}
