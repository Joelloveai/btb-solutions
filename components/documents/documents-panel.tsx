"use client";

import { useState } from "react";
import { deleteDocumentVersion } from "@/app/actions";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { Badge } from "@/components/ui/badge";
import { Button, linkButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { UploadDocumentForm } from "./upload-document-form";

export type DocRow = {
  id: string;
  name: string;
  nameKey: string;
  type: string;
  trade: string | null;
  version: number;
  isCurrent: boolean;
  fileName: string;
  sizeText: string;
  note: string | null;
  uploadedByText: string;
  uploadedAtText: string;
  uploadedAtMs: number;
};

const typeTone = { Drawing: "blue", Specification: "gray", Contract: "yellow", Other: "gray" } as const;

function History({ versions, onClose }: { versions: DocRow[]; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Version history: {versions[0]?.name}</DialogTitle>
          <DialogDescription>Every upload is kept. Only the latest is shown to your team and subcontractors.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2" data-testid="version-history">
          {versions.map((v) => (
            <li key={v.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Version {v.version}
                  {v.isCurrent ? <Badge tone="green">Current</Badge> : <Badge tone="gray">Superseded</Badge>}
                </p>
                <div className="flex items-center gap-1">
                  <a href={`/api/documents/${v.id}`} target="_blank" rel="noreferrer" className={linkButton("secondary", true)}>
                    Open
                  </a>
                  <DeleteIconButton label={`Delete version ${v.version}`} message={`Delete version ${v.version} of "${v.name}"? This cannot be undone.`} onConfirm={() => deleteDocumentVersion(v.id)} />
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {v.uploadedAtText} · {v.uploadedByText} · {v.sizeText} · {v.fileName}
              </p>
              {v.note ? <p className="mt-1 text-sm">{v.note}</p> : null}
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** The project's documents: the current version of each, with one-step "upload new version" and full history. */
export function DocumentsPanel({ projectId, docs }: { projectId: string; docs: DocRow[] }) {
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const current = docs.filter((d) => d.isCurrent).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const existing = current.map((d) => ({ nameKey: d.nameKey, name: d.name, version: Math.max(...docs.filter((x) => x.nameKey === d.nameKey).map((x) => x.version)) }));
  const versionsOf = (key: string) => docs.filter((d) => d.nameKey === key).sort((a, b) => b.version - a.version);

  return (
    <>
      <div className="mb-3 flex justify-end">
        <UploadDocumentForm projectId={projectId} existing={existing} />
      </div>
      {current.length === 0 ? (
        <EmptyState title="No documents yet" hint="Add drawings, specifications and contracts. Add the same name again to make a new version." action={<UploadDocumentForm projectId={projectId} existing={existing} />} />
      ) : (
        <ul className="space-y-2">
          {current.map((doc) => {
            const count = versionsOf(doc.nameKey).length;
            return (
              <li key={doc.id} className="rounded-xl border bg-card p-3 shadow-sm" data-testid="document-row">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                      {doc.name}
                    </a>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={typeTone[doc.type as keyof typeof typeTone] ?? "gray"}>{doc.type}</Badge>
                      <Badge tone="green">{`v${doc.version}`}</Badge>
                      {doc.trade ? <Badge tone="gray">{doc.trade}</Badge> : <span>All trades</span>}
                      <span>
                        {doc.uploadedAtText} · {doc.uploadedByText}
                      </span>
                    </p>
                    {doc.note ? <p className="mt-1 text-sm">{doc.note}</p> : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
                  <UploadDocumentForm
                    projectId={projectId}
                    existing={existing}
                    defaults={{ name: doc.name, type: doc.type, trade: doc.trade ?? "" }}
                    label="Add new version"
                    title={`New version of ${doc.name}`}
                    variant="secondary"
                  />
                  <Button small variant="ghost" onClick={() => setHistoryKey(doc.nameKey)}>
                    Version history ({count})
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {historyKey ? <History versions={versionsOf(historyKey)} onClose={() => setHistoryKey(null)} /> : null}
    </>
  );
}
