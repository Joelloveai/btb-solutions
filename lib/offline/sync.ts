import { hasIndexedDb } from "./db";
import { executeOp, type ExecResult } from "./ops";
import { listOps, removeOp, updateOp } from "./outbox";

export type DrainSummary = { synced: number; failed: number; remaining: number; authNeeded: boolean; skipped: boolean };

const MAX_ATTEMPTS = 6;
let draining = false;

/**
 * Replay the outbox in the order things were done on site. Stops at the first sign of no signal
 * (so order is kept), parks anything the server refuses as "failed" for a person to look at, and
 * NEVER deletes a change that has not been confirmed by the server.
 */
export async function drainOutbox(execute: (op: Parameters<typeof executeOp>[0]) => Promise<ExecResult> = executeOp): Promise<DrainSummary> {
  const summary: DrainSummary = { synced: 0, failed: 0, remaining: 0, authNeeded: false, skipped: false };
  if (!hasIndexedDb()) return { ...summary, skipped: true };
  if (draining) return { ...summary, skipped: true };
  draining = true;
  try {
    for (const op of await listOps()) {
      if (op.status === "failed") continue;
      const result = await execute(op);
      if (result.kind === "ok") {
        await removeOp(op.id);
        summary.synced += 1;
      } else if (result.kind === "invalid") {
        await updateOp(op.id, { status: "failed", error: result.error, attempts: op.attempts + 1 });
        summary.failed += 1;
      } else if (result.kind === "auth") {
        summary.authNeeded = true;
        break;
      } else {
        const attempts = op.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await updateOp(op.id, { status: "failed", error: `Could not reach the server after ${MAX_ATTEMPTS} tries: ${result.error}`, attempts });
          summary.failed += 1;
          continue;
        }
        await updateOp(op.id, { attempts });
        break; // no signal: keep the order and try again later
      }
    }
    summary.remaining = (await listOps()).filter((op) => op.status === "pending").length;
    return summary;
  } finally {
    draining = false;
  }
}
