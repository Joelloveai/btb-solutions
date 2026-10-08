import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal.Value;

export type ProjectTotals = {
  totalCosts: number;
  totalPayments: number;
  approvedChangeOrders: number;
  revisedContractValue: number;
  outstandingBalance: number;
  profitLoss: number;
};

const sum = (values: Money[]) =>
  values.reduce<Prisma.Decimal>((total, v) => total.plus(v), new Prisma.Decimal(0));

/**
 * Money is summed with Decimal so 0.1 + 0.2 never drifts.
 * Only APPROVED change orders count toward the contract; pending and rejected are ignored.
 */
export function calculateTotals(input: {
  contractValue: Money;
  costs: { amount: Money }[];
  payments: { amount: Money }[];
  changeOrders: { amount: Money; status: string }[];
}): ProjectTotals {
  const totalCosts = sum(input.costs.map((c) => c.amount));
  const totalPayments = sum(input.payments.map((p) => p.amount));
  const approvedChangeOrders = sum(
    input.changeOrders.filter((c) => c.status === "APPROVED").map((c) => c.amount),
  );
  const revised = new Prisma.Decimal(input.contractValue).plus(approvedChangeOrders);

  return {
    totalCosts: totalCosts.toDP(2).toNumber(),
    totalPayments: totalPayments.toDP(2).toNumber(),
    approvedChangeOrders: approvedChangeOrders.toDP(2).toNumber(),
    revisedContractValue: revised.toDP(2).toNumber(),
    outstandingBalance: revised.minus(totalPayments).toDP(2).toNumber(),
    profitLoss: revised.minus(totalCosts).toDP(2).toNumber(),
  };
}
