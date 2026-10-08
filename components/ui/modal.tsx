"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "./button";

/** Bottom sheet on phones, centred dialog on desktop. Children receive a `close` callback. */
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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl md:max-w-md md:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id={titleId} className="text-lg font-bold text-gray-900">
                {title}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-2xl text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>
            {children(() => setOpen(false))}
          </div>
        </div>
      ) : null}
    </>
  );
}
