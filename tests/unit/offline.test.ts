import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addCost: vi.fn(),
  addPayment: vi.fn(),
  createTask: vi.fn(),
  completeTask: vi.fn(),
}));
vi.mock("@/app/actions", () => actions);

import { getMeta, resetDbForTests, setMeta, wipeLocalData, type OutboxOp } from "@/lib/offline/db";
import { executeOp } from "@/lib/offline/ops";
import { enqueue, listOps, getSnapshot, saveSnapshot } from "@/lib/offline/outbox";
import { drainOutbox } from "@/lib/offline/sync";

let counter = 0;
const op = (over: Partial<OutboxOp> = {}): OutboxOp => ({
  id: `op-${++counter}-aaaaaaaa`,
  type: "addCost",
  label: "Cost",
  projectId: "p1",
  createdAt: 1000 + counter,
  status: "pending",
  attempts: 0,
  payload: { input: { amount: "10" } },
  ...over,
});

beforeEach(async () => {
  resetDbForTests();
  await wipeLocalData();
  Object.values(actions).forEach((fn) => fn.mockReset());
});

describe("outbox", () => {
  it("keeps changes in the order they were made", async () => {
    await enqueue(op({ id: "b-bbbbbbbb", createdAt: 2 }));
    await enqueue(op({ id: "a-aaaaaaaa", createdAt: 1 }));
    expect((await listOps()).map((o) => o.id)).toEqual(["a-aaaaaaaa", "b-bbbbbbbb"]);
  });

  it("erases queue, saved projects and owner on wipe", async () => {
    await enqueue(op());
    await saveSnapshot({ projectId: "p1", name: "P", savedAt: 1, costs: [], payments: [], tasks: [], photos: [] });
    await setMeta("owner", "someone");
    await wipeLocalData();
    expect(await listOps()).toEqual([]);
    expect(await getSnapshot("p1")).toBeUndefined();
    expect(await getMeta("owner")).toBeUndefined();
  });
});

describe("drainOutbox", () => {
  it("sends everything in order and empties the queue when all succeed", async () => {
    const sent: string[] = [];
    await enqueue(op({ id: "one-11111111", createdAt: 1 }));
    await enqueue(op({ id: "two-22222222", createdAt: 2 }));
    const summary = await drainOutbox(async (o) => (sent.push(o.id), { kind: "ok" }));
    expect(sent).toEqual(["one-11111111", "two-22222222"]);
    expect(summary).toMatchObject({ synced: 2, remaining: 0, failed: 0 });
    expect(await listOps()).toEqual([]);
  });

  it("stops at the first lost signal and keeps the order and the data", async () => {
    await enqueue(op({ id: "one-11111111", createdAt: 1 }));
    await enqueue(op({ id: "two-22222222", createdAt: 2 }));
    const execute = vi.fn(async () => ({ kind: "retry", error: "Failed to fetch" }) as const);
    const summary = await drainOutbox(execute);
    expect(execute).toHaveBeenCalledTimes(1); // did not skip ahead of the first one
    expect(summary.remaining).toBe(2);
    const ops = await listOps();
    expect(ops.map((o) => o.id)).toEqual(["one-11111111", "two-22222222"]);
    expect(ops[0]?.attempts).toBe(1);
  });

  it("parks a refused change for a person to look at and carries on with the rest", async () => {
    await enqueue(op({ id: "bad-11111111", createdAt: 1 }));
    await enqueue(op({ id: "good-2222222", createdAt: 2 }));
    const summary = await drainOutbox(async (o) => (o.id.startsWith("bad") ? { kind: "invalid", error: "Enter a description" } : { kind: "ok" }));
    expect(summary).toMatchObject({ synced: 1, failed: 1 });
    const [left] = await listOps();
    expect(left).toMatchObject({ id: "bad-11111111", status: "failed", error: "Enter a description" });
  });

  it("never deletes a change that the server has not confirmed, and does not retry parked ones", async () => {
    await enqueue(op({ id: "parked-1111111", status: "failed", error: "x" }));
    const execute = vi.fn(async () => ({ kind: "ok" }) as const);
    await drainOutbox(execute);
    expect(execute).not.toHaveBeenCalled();
    expect(await listOps()).toHaveLength(1);
  });

  it("pauses everything when the session has expired", async () => {
    await enqueue(op({ id: "one-11111111", createdAt: 1 }));
    await enqueue(op({ id: "two-22222222", createdAt: 2 }));
    const summary = await drainOutbox(async () => ({ kind: "auth" }));
    expect(summary.authNeeded).toBe(true);
    expect(await listOps()).toHaveLength(2);
  });

  it("gives up after repeated failures but keeps the change visible as needing attention", async () => {
    await enqueue(op({ id: "stuck-1111111", attempts: 5 }));
    const summary = await drainOutbox(async () => ({ kind: "retry", error: "Server busy" }));
    expect(summary.failed).toBe(1);
    expect((await listOps())[0]).toMatchObject({ status: "failed" });
  });
});

describe("executeOp", () => {
  it("sends the queue id as the request id, so a retry can never apply twice", async () => {
    actions.addCost.mockResolvedValue({ ok: true });
    const o = op({ id: "req-12345678" });
    expect(await executeOp(o)).toEqual({ kind: "ok" });
    expect(actions.addCost).toHaveBeenCalledWith("p1", o.payload.input, "req-12345678");
  });

  it("classifies what the server says", async () => {
    actions.addPayment.mockResolvedValue({ ok: false, error: "Must be more than 0" });
    expect(await executeOp(op({ type: "addPayment" }))).toEqual({ kind: "invalid", error: "Must be more than 0" });
    actions.addPayment.mockResolvedValue({ ok: false, error: "Please sign in again." });
    expect(await executeOp(op({ type: "addPayment" }))).toEqual({ kind: "auth" });
    actions.addPayment.mockResolvedValue({ ok: false, error: "Something went wrong. Please try again." });
    expect(await executeOp(op({ type: "addPayment" }))).toMatchObject({ kind: "retry" });
  });

  it("treats a network failure as try-again-later, not as an error", async () => {
    actions.createTask.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await executeOp(op({ type: "createTask" }))).toMatchObject({ kind: "retry", error: "Failed to fetch" });
  });

  it("uploads a task photo first, then completes the task with it", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(`upload:${(init.body as FormData).get("requestId")}`);
        return new Response(JSON.stringify({ id: "photo123456" }), { status: 201 });
      }),
    );
    actions.completeTask.mockImplementation(async (_t: string, photoId?: string) => (calls.push(`complete:${photoId}`), { ok: true }));
    await enqueue(op({ id: "done-12345678", type: "completeTask", payload: { taskId: "t1" }, file: { bytes: new ArrayBuffer(4), type: "image/png", name: "a.png" }, fields: { kind: "TASK", taskId: "t1" } }));
    const stored = (await listOps())[0]!;
    expect(await executeOp(stored)).toEqual({ kind: "ok" });
    expect(calls).toEqual(["upload:done-12345678-p", "complete:photo123456"]);
    vi.unstubAllGlobals();
  });
});
