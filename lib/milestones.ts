export type MilestoneLike = { dueDate: Date; completedDate: Date | null; status: string; weightagePercent: { toString(): string } | number };
export type MilestoneStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";

/** What to show: done if completed, late if overdue and unfinished (whatever was stored), else the stored state. */
export function displayStatus(m: MilestoneLike, today: Date): MilestoneStatus {
  if (m.completedDate || m.status === "COMPLETED") return "COMPLETED";
  if (m.dueDate < today) return "DELAYED";
  return m.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING";
}

/** Share of the contract delivered, by weightage. Milestones with no weight count equally when none has any. */
export function weightedProgress(ms: MilestoneLike[]): number | null {
  if (ms.length === 0) return null;
  const weights = ms.map((m) => Number(m.weightagePercent.toString()));
  const total = weights.reduce((a, b) => a + b, 0);
  const done = ms.map((m, i) => (m.completedDate || m.status === "COMPLETED" ? (total > 0 ? weights[i]! : 1) : 0)).reduce((a, b) => a + b, 0);
  return Math.round((done / (total > 0 ? total : ms.length)) * 100);
}
