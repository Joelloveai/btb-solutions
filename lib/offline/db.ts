import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/** What can wait in the outbox until the phone has signal again. */
export type OpType = "addCost" | "addPayment" | "createTask" | "completeTask" | "uploadPhoto" | "createPunch" | "resolvePunch" | "uploadDocument" | "createSelection" | "createDailyLog" | "addNote" | "createDiary" | "addSubNote";

export type StoredFile = { bytes: ArrayBuffer; type: string; name: string };

export type OutboxOp = {
  /** Also sent to the server as the request id, so a retry can never apply twice. */
  id: string;
  type: OpType;
  /** Shown in the "waiting to sync" list. */
  label: string;
  projectId?: string;
  createdAt: number;
  status: "pending" | "failed";
  error?: string;
  attempts: number;
  /** JSON-safe arguments for the action (never Blobs; files go in `file`). */
  payload: Record<string, unknown>;
  file?: StoredFile;
  /** Extra multipart fields for photo uploads (kind, caption, capturedAt, latitude, ...). */
  fields?: Record<string, string>;
};

export type SnapshotPhoto = { id: string; caption: string | null; takenAtText: string; thumb?: StoredFile };

/** The last-known data for one project, kept on the device so it can still be read with no signal. */
export type ProjectSnapshot = {
  projectId: string;
  name: string;
  savedAt: number;
  costs: { id: string; dateText: string; category: string; description: string; amountText: string }[];
  payments: { id: string; dateText: string; amountText: string; reference: string | null }[];
  tasks: { id: string; description: string; dueText: string; status: string; subcontractorName: string | null }[];
  photos: SnapshotPhoto[];
};

interface BtbDB extends DBSchema {
  outbox: { key: string; value: OutboxOp; indexes: { "by-created": number } };
  snapshots: { key: string; value: ProjectSnapshot };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<BtbDB>> | null = null;

export const hasIndexedDb = () => typeof indexedDB !== "undefined";

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<BtbDB>("btb-offline", 1, {
      upgrade(db) {
        db.createObjectStore("outbox", { keyPath: "id" }).createIndex("by-created", "createdAt");
        db.createObjectStore("snapshots", { keyPath: "projectId" });
        db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

/** For tests: forget the cached connection. */
export function resetDbForTests() {
  dbPromise = null;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  if (!hasIndexedDb()) return undefined;
  return (await (await getDb()).get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  if (!hasIndexedDb()) return;
  await (await getDb()).put("meta", value, key);
}

/** Erase everything this app stored on the device (used on sign-out and when a different person signs in). */
export async function wipeLocalData() {
  if (!hasIndexedDb()) return;
  const db = await getDb();
  const tx = db.transaction(["outbox", "snapshots", "meta"], "readwrite");
  await Promise.all([tx.objectStore("outbox").clear(), tx.objectStore("snapshots").clear(), tx.objectStore("meta").clear(), tx.done]);
}
