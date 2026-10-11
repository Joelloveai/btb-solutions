import { getDb, hasIndexedDb, type OutboxOp, type ProjectSnapshot } from "./db";

const CHANNEL = "btb-outbox";
export const OUTBOX_EVENT = "btb-outbox-changed";

/** Tell this tab (and any other open tab) that the queue changed, so lists and badges refresh. */
function announce() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OUTBOX_EVENT));
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* BroadcastChannel is optional */
  }
}

export function onOutboxChange(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(OUTBOX_EVENT, listener);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = listener;
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener(OUTBOX_EVENT, listener);
    channel?.close();
  };
}

export async function enqueue(op: OutboxOp) {
  if (!hasIndexedDb()) throw new Error("This browser cannot save changes on the device.");
  await (await getDb()).put("outbox", op);
  // Ask the browser not to evict the queue under storage pressure (photos can be large).
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }
  announce();
}

export async function listOps(): Promise<OutboxOp[]> {
  if (!hasIndexedDb()) return [];
  return (await getDb()).getAllFromIndex("outbox", "by-created");
}

export async function removeOp(id: string) {
  if (!hasIndexedDb()) return;
  await (await getDb()).delete("outbox", id);
  announce();
}

export async function updateOp(id: string, patch: Partial<OutboxOp>) {
  if (!hasIndexedDb()) return;
  const db = await getDb();
  const current = await db.get("outbox", id);
  if (current) await db.put("outbox", { ...current, ...patch });
  announce();
}

/** Put a failed op back in line to be retried. */
export const retryOp = (id: string) => updateOp(id, { status: "pending", error: undefined, attempts: 0 });

export async function saveSnapshot(snapshot: ProjectSnapshot) {
  if (!hasIndexedDb()) return;
  await (await getDb()).put("snapshots", snapshot);
}

export async function getSnapshot(projectId: string) {
  if (!hasIndexedDb()) return undefined;
  return (await getDb()).get("snapshots", projectId);
}

export async function listSnapshots(): Promise<ProjectSnapshot[]> {
  if (!hasIndexedDb()) return [];
  return (await (await getDb()).getAll("snapshots")).sort((a, b) => b.savedAt - a.savedAt);
}
