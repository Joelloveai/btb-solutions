import { describe, expect, it } from "vitest";
import { owedSummary } from "@/lib/sub-owed";
import { afterFailure, isLocked } from "@/lib/pin-throttle";

describe("owedSummary", () => {
  it("adds up only unpaid costs, per project, without float drift", () => {
    const paid = new Date();
    const r = owedSummary([
      { projectId: "a", projectName: "Alpha", amount: "1000.10", paidAt: null },
      { projectId: "a", projectName: "Alpha", amount: "200.20", paidAt: null },
      { projectId: "a", projectName: "Alpha", amount: "999", paidAt: paid },
      { projectId: "b", projectName: "Beta", amount: "50.05", paidAt: null },
      { projectId: "c", projectName: "Gamma", amount: "75", paidAt: paid },
    ]);
    expect(r.total.toFixed(2)).toBe("1250.35");
    expect(r.projects.map((p) => [p.name, p.owed.toFixed(2)])).toEqual([["Alpha", "1200.30"], ["Beta", "50.05"]]);
  });
  it("is zero when nothing is owed", () => {
    expect(owedSummary([]).total.toFixed(2)).toBe("0.00");
  });
});

describe("PIN throttle rule", () => {
  const t0 = new Date("2026-10-12T10:00:00Z");
  const at = (m: number) => new Date(t0.getTime() + m * 60_000);
  it("locks on the fifth wrong PIN within 15 minutes, for 15 minutes", () => {
    let t = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < 4; i++) {
      t = afterFailure(t, at(i));
      expect(isLocked(t, at(i))).toBe(false);
    }
    t = afterFailure(t, at(5));
    expect(t.failures).toBe(5);
    expect(isLocked(t, at(6))).toBe(true);
    expect(isLocked(t, at(19))).toBe(true);
    expect(isLocked(t, at(21))).toBe(false);
  });
  it("forgets old failures after the window", () => {
    let t = afterFailure(null, at(0));
    t = afterFailure(t, at(1));
    t = afterFailure(t, at(20));
    expect(t.failures).toBe(1);
  });
});
