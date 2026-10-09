"use client";

import { useCallback, useState } from "react";
import type { ActionResult } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";
import { useSubmit } from "./use-submit";

const iconButton =
  "flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100";

export function EditIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={iconButton}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
  );
}

export function DeleteIconButton({
  label,
  message,
  onConfirm,
}: {
  label: string;
  message: string;
  onConfirm: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { pending, submit } = useSubmit("Deleted", close);
  const t = useT();

  return (
    <>
      <button type="button" aria-label={label} onClick={() => setOpen(true)} className={`${iconButton} text-red-600 hover:bg-red-50`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
        </svg>
      </button>
      <Modal open={open} onClose={close} title="Confirm delete">
        <p className="mb-5 text-base text-gray-800">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={close} disabled={pending}>
            {t.cancel}
          </Button>
          <Button variant="danger" onClick={() => submit(onConfirm)} disabled={pending}>
            {pending ? "…" : t.delete}
          </Button>
        </div>
      </Modal>
    </>
  );
}
