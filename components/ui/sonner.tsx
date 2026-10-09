"use client";

import { Toaster as Sonner } from "sonner";

/** shadcn-style Sonner: toasts use the app's card tokens instead of Sonner's default colours. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: "group rounded-lg border bg-popover text-popover-foreground shadow-lg font-sans",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
