"use client";

import { FileText, PenLine } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { countersignSiteDiary } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { PendingOps } from "@/components/offline/pending-ops";
import { Badge } from "@/components/ui/badge";
import { Button, linkButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DiaryForm, type MaterialCost } from "./diary-form";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

export type DiaryRow = {
  id: string;
  dateKey: string;
  dateText: string;
  weather: string;
  locked: boolean;
  preparedBy: string;
  preparedAtText: string;
  verifiedBy: string | null;
  verifiedAtText: string | null;
  /** True when someone other than the preparer is signed in and it still needs a second signature. */
  canCountersign: boolean;
};

function Countersign({ row }: { row: DiaryRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const pad = useRef<SignaturePadHandle>(null);
  const { pending, submit } = useSubmit("Countersigned. The diary is now locked.", () => setOpen(false));
  return (
    <>
      <Button small onClick={() => setOpen(true)}>
        <PenLine className="h-4 w-4" aria-hidden="true" /> Countersign
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Countersign diary for ${row.dateText}`}>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Prepared by {row.preparedBy}. Open the PDF and check it first. Once you sign, it is locked and cannot be changed.
          </p>
          <a href={`/api/diaries/${row.id}/pdf`} target="_blank" rel="noreferrer" className={linkButton("secondary")}>
            <FileText className="h-4 w-4" aria-hidden="true" /> Read the diary (PDF)
          </a>
          <SignaturePad ref={pad} label="Sign here" />
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => {
              const signature = pad.current?.toDataUrl();
              if (!signature) return setError("Please sign in the box.");
              setError("");
              submit(() => countersignSiteDiary(row.id, signature));
            }}
          >
            {pending ? "Saving…" : "Sign and lock"}
          </Button>
        </div>
      </Modal>
    </>
  );
}

export function DiaryPanel({ projectId, rows, materialCosts }: { projectId: string; rows: DiaryRow[]; materialCosts: MaterialCost[] }) {
  const [open, setOpen] = useState(false);
  const waiting = rows.filter((r) => !r.locked);
  return (
    <section aria-label="Site diary" className="space-y-4">
      <PendingOps projectId={projectId} types={["createDiary"]} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={() => setOpen(true)}>+ Sign Site Diary</Button>
        <Link href={`/projects/${projectId}/diary/report`} className={linkButton("secondary")}>
          Printable summary
        </Link>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Site diary">
        {open ? <DiaryForm projectId={projectId} materialCosts={materialCosts} close={() => setOpen(false)} /> : null}
      </Modal>

      {waiting.length > 0 ? (
        <p className="rounded-lg bg-pending-light px-3 py-2 text-sm text-pending-dark" data-testid="diary-waiting">
          {waiting.length} {waiting.length === 1 ? "diary is" : "diaries are"} waiting for a countersignature.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No diaries yet. Tap “Sign Site Diary” at the end of each working day.</p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} data-testid="diary-row" className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{r.dateText}</p>
              {r.locked ? (
                <Badge tone="green">Locked</Badge>
              ) : (
                <Badge tone="yellow">Awaiting countersignature</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {r.weather}. Prepared by {r.preparedBy}, {r.preparedAtText}
              {r.verifiedBy ? `. Countersigned by ${r.verifiedBy}, ${r.verifiedAtText}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={`/api/diaries/${r.id}/pdf`} target="_blank" rel="noreferrer" className={linkButton("secondary", true)}>
                <FileText className="h-4 w-4" aria-hidden="true" /> PDF
              </a>
              {r.canCountersign ? <Countersign row={r} /> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
