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

/** A short code for numbering: the initials of the project name's words ("Taman Sri Petaling Reno" -> "TSPR"), or its first letters. */
export function projectCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "PRJ";
  const code = words.length > 1 ? words.map((w) => w[0]).join("") : words[0]!.slice(0, 4);
  return code.slice(0, 5);
}

/** PROJECTCODE/YYYY/CLM/SEQ, e.g. TSPR/2026/CLM/003. */
export const claimNumberFor = (code: string, claimDate: Date, seq: number) => `${code}/${claimDate.getUTCFullYear()}/CLM/${String(seq).padStart(3, "0")}`;

/** What a BOQ item can be billed for now: the work done since the last claim, at its rate. */
export function boqClaimLine(line: { description: string; unit: string; qty: Money; rate: Money; completedQuantity: Money; claimedQuantity: Money }) {
  const thisPeriodQty = D(line.completedQuantity).minus(line.claimedQuantity);
  if (thisPeriodQty.lessThanOrEqualTo(0)) return null;
  return {
    description: line.description,
    unit: line.unit,
    quantity: thisPeriodQty,
    rate: D(line.rate),
    previousAmount: D(line.claimedQuantity).times(line.rate).toDP(2),
    currentAmount: thisPeriodQty.times(line.rate).toDP(2),
    amount: D(line.completedQuantity).times(line.rate).toDP(2),
  };
}
