import { Prisma } from "@prisma/client";

export type OwedCost = { projectId: string; projectName: string; amount: Prisma.Decimal.Value; paidAt: Date | null };
export type Owed = { total: Prisma.Decimal; projects: { projectId: string; name: string; owed: Prisma.Decimal }[] };

/** What a subcontractor is still owed: their SUBCON costs the contractor has not yet marked paid, by project. */
export function owedSummary(costs: OwedCost[]): Owed {
  const byProject = new Map<string, { name: string; owed: Prisma.Decimal }>();
  for (const c of costs) {
    if (c.paidAt) continue;
    const entry = byProject.get(c.projectId) ?? { name: c.projectName, owed: new Prisma.Decimal(0) };
    entry.owed = entry.owed.plus(c.amount);
    byProject.set(c.projectId, entry);
  }
  const projects = Array.from(byProject, ([projectId, v]) => ({ projectId, ...v })).filter((p) => p.owed.greaterThan(0)).sort((a, b) => b.owed.comparedTo(a.owed));
  return { total: projects.reduce((t, p) => t.plus(p.owed), new Prisma.Decimal(0)), projects };
}
