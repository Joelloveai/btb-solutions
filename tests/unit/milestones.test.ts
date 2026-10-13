import { describe, expect, it } from "vitest";
import { displayStatus, weightedProgress } from "@/lib/milestones";

const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const today = day("2026-10-13");
const m = (due: string, done: string | null, status = "PENDING", w: number | string = 0) => ({ dueDate: day(due), completedDate: done ? day(done) : null, status, weightagePercent: w });

describe("milestones", () => {
  it("shows done, late and upcoming correctly", () => {
    expect(displayStatus(m("2026-10-01", "2026-10-02"), today)).toBe("COMPLETED");
    expect(displayStatus(m("2026-10-01", null), today)).toBe("DELAYED");
    expect(displayStatus(m("2026-10-13", null), today)).toBe("PENDING"); // due today is not late yet
    expect(displayStatus(m("2026-11-01", null, "IN_PROGRESS"), today)).toBe("IN_PROGRESS");
  });
  it("weights progress, and falls back to counting when no weights are set", () => {
    expect(weightedProgress([m("2026-10-01", "2026-10-01", "COMPLETED", 30), m("2026-12-01", null, "PENDING", 70)])).toBe(30);
    expect(weightedProgress([m("2026-10-01", "2026-10-01"), m("2026-12-01", null), m("2027-01-01", null), m("2027-02-01", null)])).toBe(25);
    expect(weightedProgress([])).toBeNull();
  });
});
