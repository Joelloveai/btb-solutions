import { describe, expect, it } from "vitest";
import { hashEvent, verifyChain } from "@/lib/timeline";

function chain(n: number) {
  const events = [];
  let previousHash: string | null = null;
  for (let seq = 1; seq <= n; seq++) {
    const base = {
      projectId: "p1",
      seq,
      eventType: "COST",
      actorId: "u1",
      actorRole: "staff",
      title: `Cost added: RM ${seq * 100}.00`,
      description: `item ${seq}`,
      metadata: JSON.stringify({ amount: `${seq * 100}.00` }),
      latitude: null,
      longitude: null,
      capturedAt: new Date(Date.UTC(2026, 9, 11, 8, seq)),
      createdAt: new Date(Date.UTC(2026, 9, 11, 8, seq, 30)),
      previousHash,
    };
    const hash = hashEvent(base);
    events.push({ ...base, hash });
    previousHash = hash;
  }
  return events;
}

describe("timeline hash chain", () => {
  it("accepts an untouched chain and an empty one", () => {
    expect(verifyChain(chain(5))).toMatchObject({ ok: true, count: 5 });
    expect(verifyChain([])).toEqual({ ok: true, count: 0, head: null });
  });

  it("is deterministic", () => {
    expect(chain(3)[2]!.hash).toBe(chain(3)[2]!.hash);
  });

  it("detects an edited amount, naming the first bad entry", () => {
    const events = chain(5);
    events[2]!.metadata = JSON.stringify({ amount: "1.00" });
    expect(verifyChain(events)).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });

  it("detects an edited timestamp, title or actor", () => {
    for (const change of [
      (e: ReturnType<typeof chain>[number]) => (e.capturedAt = new Date(e.capturedAt.getTime() - 86_400_000)),
      (e: ReturnType<typeof chain>[number]) => (e.title = "Cost added: RM 1.00"),
      (e: ReturnType<typeof chain>[number]) => (e.actorId = "someone-else"),
    ]) {
      const events = chain(4);
      change(events[1]!);
      expect(verifyChain(events)).toMatchObject({ ok: false, brokenAtSeq: 2 });
    }
  });

  it("detects a removed entry, in the middle or at the start", () => {
    const middle = chain(5);
    middle.splice(2, 1);
    expect(verifyChain(middle)).toMatchObject({ ok: false, brokenAtSeq: 3 });
    const start = chain(3);
    start.shift();
    expect(verifyChain(start)).toMatchObject({ ok: false, brokenAtSeq: 1 });
  });

  it("detects a rewritten entry whose hash was recomputed but whose successor was not", () => {
    const events = chain(4);
    events[1]!.title = "Cost added: RM 1.00";
    events[1]!.hash = hashEvent(events[1]!);
    expect(verifyChain(events)).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });
});
