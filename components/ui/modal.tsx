"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useCan } from "@/components/permissions-provider";
import type { Capability } from "@/lib/permissions";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

/** shadcn Dialog behind the app's original Modal API (open / onClose / title). */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** A button that opens a Modal. Children receive a `close` callback. */
export function ModalButton({
  label,
  title,
  variant = "primary",
  requires = "money.write",
  children,
}: {
  label: string;
  title: string;
  variant?: "primary" | "secondary";
  /** Who gets this button. Money screens default to managers and admins; site work passes "field.write". */
  requires?: Capability;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const allowed = useCan();
  if (!allowed(requires)) return null;

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={close} title={title}>
        {children(close)}
      </Modal>
    </>
  );
}
