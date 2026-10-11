"use client";

import { useEffect, useState } from "react";
import type { OutboxOp } from "@/lib/offline/db";
import { listOps, onOutboxChange } from "@/lib/offline/outbox";

/** The changes waiting on this device, kept live as the queue changes. */
export function useOutbox(): OutboxOp[] {
  const [ops, setOps] = useState<OutboxOp[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => listOps().then((list) => alive && setOps(list)).catch(() => undefined);
    void load();
    const off = onOutboxChange(() => void load());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return ops;
}
