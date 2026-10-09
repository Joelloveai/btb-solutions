import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal.Value;

export type ProjectTotals = {
  totalCosts: number;
  totalPayments: number;
  approvedChangeOrders: number;
  revisedContractValue: number;
  outstandingBalance: number;
  profitLoss: number;
  /** SST on the revised contract; 0 when the project has SST turned off. */
  sstAmount: number;
  /** Revised contract plus SST: what the client is billed in total. */
  billableTotal: number;
};

const sum = (values: Money[]) =>
  values.reduce<Prisma.Decimal>((total, v) => total.plus(v), new Prisma.Decimal(0));

/**
 * Money is summed with Decimal so 0.1 + 0.2 never drifts.
 * Only APPROVED change orders count toward the contract; pending and rejected are ignored.
 * SST is charged on the revised contract and added to what the client owes, but it is a
 * tax passed on to the government, so it is left out of profit/loss.
 */
export function calculateTotals(input: {
  contractValue: Money;
  costs: { amount: Money }[];
  payments: { amount: Money }[];
  changeOrders: { amount: Money; status: string }[];
  sstEnabled?: boolean;
  sstRate?: Money;
}): ProjectTotals {
  const totalCosts = sum(input.costs.map((c) => c.amount));
  const totalPayments = sum(input.payments.map((p) => p.amount));
  const approvedChangeOrders = sum(
    input.changeOrders.filter((c) => c.status === "APPROVED").map((c) => c.amount),
  );
  const revised = new Prisma.Decimal(input.contractValue).plus(approvedChangeOrders);

  const sst = input.sstEnabled
    ? revised.times(input.sstRate ?? 6).dividedBy(100).toDP(2)
    : new Prisma.Decimal(0);
  const billable = revised.plus(sst);

  return {
    totalCosts: totalCosts.toDP(2).toNumber(),
    totalPayments: totalPayments.toDP(2).toNumber(),
    approvedChangeOrders: approvedChangeOrders.toDP(2).toNumber(),
    revisedContractValue: revised.toDP(2).toNumber(),
    outstandingBalance: billable.minus(totalPayments).toDP(2).toNumber(),
    profitLoss: revised.minus(totalCosts).toDP(2).toNumber(),
    sstAmount: sst.toNumber(),
    billableTotal: billable.toDP(2).toNumber(),
  };
}
