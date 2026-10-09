import { Prisma } from "@prisma/client";
import { calculateTotals, type ProjectTotals } from "./calculations";

type Money = Prisma.Decimal.Value;

export type ProjectSummary = ProjectTotals & {
  claimsIssued: number;
  claimCount: number;
  subconOwed: number;
  retentionHeld: number;
  retentionReleased: number;
  retentionOutstanding: number;
  /** Revised contract (with approved variations, without SST) minus every cost. */
  realProfit: number;
};

/**
 * SST is tax collected for the government, so it is not counted as profit.
 * Subcon costs are already inside total costs, so "owed" is shown but never subtracted twice.
 * Retention is money the client still owes us, not money lost, so it is shown but not subtracted.
 */
export function summarizeProject(project: {
  contractValue: Money;
  sstEnabled?: boolean;
  sstRate?: Money;
  retentionReleased?: Money;
  costs: { amount: Money; category?: string; paidAt?: Date | null }[];
  payments: { amount: Money }[];
  changeOrders: { amount: Money; status: string }[];
  claims?: { amountClaimed: Money; retentionAmount: Money }[];
}): ProjectSummary {
  const totals = calculateTotals(project);
  const sum = (values: Money[]) =>
    values.reduce<Prisma.Decimal>((t, v) => t.plus(v), new Prisma.Decimal(0)).toDP(2).toNumber();
  const claims = project.claims ?? [];
  const held = sum(claims.map((c) => c.retentionAmount));
  const released = new Prisma.Decimal(project.retentionReleased ?? 0).toDP(2).toNumber();
  return {
    ...totals,
    claimsIssued: sum(claims.map((c) => c.amountClaimed)),
    claimCount: claims.length,
    subconOwed: sum(project.costs.filter((c) => c.category === "SUBCON" && !c.paidAt).map((c) => c.amount)),
    retentionHeld: held,
    retentionReleased: released,
    retentionOutstanding: new Prisma.Decimal(held).minus(released).toDP(2).toNumber(),
    realProfit: totals.profitLoss,
  };
}
