"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import type { OutboxOp } from "@/lib/offline/db";
import { newId } from "@/lib/offline/id";
import { executeOp } from "@/lib/offline/ops";
import { enqueue } from "@/lib/offline/outbox";
import { useOffline } from "./offline-provider";

export type NewOp = Pick<OutboxOp, "type" | "label" | "projectId" | "payload" | "file" | "fields">;

/**
 * Like useSubmit, but a change made with no signal is not lost: it is saved on the device and sent
 * when the connection returns. The same id is used for the live attempt and any later retry, so
 * the server can tell a repeat from a new entry and never applies one twice.
 */
export function useOfflineSubmit(successMessage: string, close: () => void) {
  const router = useRouter();
  const { online, syncNow } = useOffline();
  const [pending, startTransition] = useTransition();

  const queue = async (op: OutboxOp) => {
    await enqueue(op);
    toast.success("Saved on this device. It will sync when you are back online.");
    close();
  };

  const submit = (input: NewOp) =>
    startTransition(async () => {
      const op: OutboxOp = { ...input, id: newId(), createdAt: Date.now(), status: "pending", attempts: 0 };
      try {
        if (!online) return await queue(op);
        const result = await executeOp(op);
        if (result.kind === "ok") {
          toast.success(successMessage);
          close();
          router.refresh();
        } else if (result.kind === "retry") {
          await queue(op); // weak or no signal: keep it, and the same id protects against a double
          void syncNow();
        } else if (result.kind === "auth") {
          toast.error("Please sign in again.");
        } else {
          toast.error(result.error);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save. Please try again.");
      }
    });

  return { pending, submit };
}
