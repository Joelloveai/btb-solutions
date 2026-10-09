"use client";

import { useCallback, useState, type ReactNode } from "react";
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
  children,
}: {
  label: string;
  title: string;
  variant?: "primary" | "secondary";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

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
