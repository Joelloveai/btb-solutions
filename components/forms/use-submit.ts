"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions";

/** Runs a server action, shows a toast with the outcome, and closes the modal on success. */
export function useSubmit(successMessage: string, close: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const submit = (run: () => Promise<ActionResult<unknown>>) => {
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        toast.success(successMessage);
        close();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return { pending, submit };
}
