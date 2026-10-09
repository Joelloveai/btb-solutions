import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal.Value;
const D = (v: Money) => new Prisma.Decimal(v);

export type ClaimFigures = {
  workDone: number;
  sstAmount: number;
  amountClaimed: number;
  retentionPercent: number;
  retentionAmount: number;
  previousClaimed: number;
  netClaim: number;
};

/**
 * Work done this period is the gross value being claimed. SST (if the project has it) is
 * added on top, retention is held back from the work done, and the net claim is what the
 * client should actually pay now.
 */
export function computeClaim(input: {
  workDone: Money;
  retentionPercent: Money;
  sstEnabled: boolean;
  sstRate: Money;
  previousClaimed: Money;
}): ClaimFigures {
  const workDone = D(input.workDone);
  const sst = input.sstEnabled ? workDone.times(input.sstRate).dividedBy(100).toDP(2) : D(0);
  const retention = workDone.times(input.retentionPercent).dividedBy(100).toDP(2);
  const amountClaimed = workDone.plus(sst);
  return {
    workDone: workDone.toDP(2).toNumber(),
    sstAmount: sst.toNumber(),
    amountClaimed: amountClaimed.toDP(2).toNumber(),
    retentionPercent: D(input.retentionPercent).toNumber(),
    retentionAmount: retention.toNumber(),
    previousClaimed: D(input.previousClaimed).toDP(2).toNumber(),
    netClaim: amountClaimed.minus(retention).toDP(2).toNumber(),
  };
}

/** What is still unpaid on a claim, given the payments linked to it. */
export function claimBalance(netClaim: Money, payments: { amount: Money }[]): { paid: number; balance: number } {
  const paid = payments.reduce<Prisma.Decimal>((t, p) => t.plus(p.amount), D(0));
  return { paid: paid.toDP(2).toNumber(), balance: D(netClaim).minus(paid).toDP(2).toNumber() };
}
