import { addCost, addPayment, completeTask, createPunchItem, createTask, resolvePunchItem, type ActionResult } from "@/app/actions";
import { updateOp } from "./outbox";
import type { OutboxOp } from "./db";

/** How one attempt to apply a queued change turned out. */
export type ExecResult =
  | { kind: "ok" }
  /** The server understood and refused (validation, permission): the user needs to look at it. */
  | { kind: "invalid"; error: string }
  /** The session expired: nothing can sync until the user signs in again. */
  | { kind: "auth" }
  /** No signal, a timeout or a server hiccup: keep it queued and try again later. */
  | { kind: "retry"; error: string };

const SIGN_IN_AGAIN = "Please sign in again.";
const GENERIC_FAILURE = "Something went wrong. Please try again.";
export const ATTEMPT_TIMEOUT_MS = 20_000;

export function withTimeout<T>(promise: Promise<T>, ms = ATTEMPT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function fromAction(result: ActionResult<unknown>): ExecResult {
  if (result.ok) return { kind: "ok" };
  if (result.error === SIGN_IN_AGAIN) return { kind: "auth" };
  // The server's catch-all message means "something broke on my side", which is worth retrying.
  if (result.error === GENERIC_FAILURE) return { kind: "retry", error: result.error };
  return { kind: "invalid", error: result.error };
}

async function uploadFile(op: OutboxOp, requestId: string, endpoint = "/api/photos"): Promise<{ id: string } | ExecResult> {
  if (!op.file) return { kind: "invalid", error: "The file is missing from this device." };
  const body = new FormData();
  body.set("file", new Blob([op.file.bytes], { type: op.file.type }), op.file.name);
  for (const [key, value] of Object.entries(op.fields ?? {})) body.set(key, value);
  body.set("requestId", requestId);
  const response = await fetch(endpoint, { method: "POST", body });
  if (response.status === 401) return { kind: "auth" };
  const json = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
  if (response.ok && json.id) return { id: json.id };
  if (response.status >= 500 || response.status === 408 || response.status === 429) {
    return { kind: "retry", error: json.error ?? `Server busy (${response.status})` };
  }
  return { kind: "invalid", error: json.error ?? "The photo was refused." };
}

/** Apply one queued change. Sending the op's own id as the request id makes any retry safe. */
export async function executeOp(op: OutboxOp): Promise<ExecResult> {
  try {
    switch (op.type) {
      case "addCost":
        return fromAction(await withTimeout(addCost(op.projectId as string, op.payload.input, op.id)));
      case "addPayment":
        return fromAction(await withTimeout(addPayment(op.projectId as string, op.payload.input, op.id)));
      case "createTask":
        return fromAction(await withTimeout(createTask(op.projectId as string, op.payload.input, op.id)));
      case "uploadPhoto": {
        const uploaded = await withTimeout(uploadFile(op, op.id));
        return "id" in uploaded ? { kind: "ok" } : uploaded;
      }
      case "completeTask": {
        let photoId = typeof op.payload.photoId === "string" ? op.payload.photoId : undefined;
        if (op.file && !photoId) {
          const uploaded = await withTimeout(uploadFile(op, `${op.id}-p`));
          if (!("id" in uploaded)) return uploaded;
          photoId = uploaded.id;
          // Remember it, so a retry after a lost response does not upload the photo again.
          await updateOp(op.id, { payload: { ...op.payload, photoId } });
        }
        return fromAction(await withTimeout(completeTask(op.payload.taskId as string, photoId)));
      }
      case "uploadDocument": {
        const uploaded = await withTimeout(uploadFile(op, op.id, "/api/documents"), 120_000);
        return "id" in uploaded ? { kind: "ok" } : uploaded;
      }
      case "createPunch": {
        // The photo of the defect goes up first (and is remembered), then the item that points at it.
        let photoId = typeof op.payload.photoId === "string" ? op.payload.photoId : undefined;
        if (op.file && !photoId) {
          const uploaded = await withTimeout(uploadFile(op, `${op.id}-p`));
          if (!("id" in uploaded)) return uploaded;
          photoId = uploaded.id;
          await updateOp(op.id, { payload: { ...op.payload, photoId } });
        }
        return fromAction(await withTimeout(createPunchItem(op.projectId as string, op.payload.input, op.id, photoId)));
      }
      case "resolvePunch": {
        let photoId = typeof op.payload.photoId === "string" ? op.payload.photoId : undefined;
        if (op.file && !photoId) {
          const uploaded = await withTimeout(uploadFile(op, `${op.id}-p`));
          if (!("id" in uploaded)) return uploaded;
          photoId = uploaded.id;
          await updateOp(op.id, { payload: { ...op.payload, photoId } });
        }
        return fromAction(await withTimeout(resolvePunchItem(op.payload.punchId as string, photoId)));
      }
      default:
        return { kind: "invalid", error: `Unknown change type: ${String((op as OutboxOp).type)}` };
    }
  } catch (error) {
    // fetch() rejects when there is no signal; Next throws on a broken response. Either way: try again later.
    return { kind: "retry", error: error instanceof Error ? error.message : "Could not reach the server" };
  }
}
