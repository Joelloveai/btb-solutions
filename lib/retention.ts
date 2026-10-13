import { Prisma } from "@prisma/client";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const DAY = 86_400_000;

export type RetentionInput = {
  claims: { number: number; retentionAmount: Prisma.Decimal.Value }[];
  released: Prisma.Decimal.Value;
  contractValue: Prisma.Decimal.Value;
  /** Share of the CONTRACT SUM released at practical completion (default 2.5%); the rest after the defects liability period. */
  releasePercent: Prisma.Decimal.Value;
  contractEndDate: Date | null;
  defectsLiabilityDays: number;
  today: Date;
};

export type RetentionReport = {
  rows: { number: number; held: number; cumulative: number }[];
  held: number;
  released: number;
  outstanding: number;
  /** At practical completion: half-ish release, the percentage of the contract sum (never more than is held). */
  firstRelease: { amount: number; dueDate: Date | null };
  /** After the defects liability period: whatever is still held. */
  finalRelease: { dueDate: Date | null };
  /** Release that should already have been paid by today, and what is still missing. */
  dueByNow: number;
  overdueRelease: number;
  /** Plain words for the alert, or null when nothing is due. */
  alert: string | null;
};

export function retentionReport(input: RetentionInput): RetentionReport {
  let cumulative = D(0);
  const rows = [...input.claims]
    .sort((a, b) => a.number - b.number)
    .map((c) => {
      cumulative = cumulative.plus(c.retentionAmount);
      return { number: c.number, held: D(c.retentionAmount).toDP(2).toNumber(), cumulative: cumulative.toDP(2).toNumber() };
    });
  const held = cumulative;
  const released = D(input.released);
  const outstanding = held.minus(released);
  const firstAmount = Prisma.Decimal.min(held, D(input.contractValue).times(input.releasePercent).dividedBy(100)).toDP(2);
  const end = input.contractEndDate;
  const finalDue = end ? new Date(end.getTime() + input.defectsLiabilityDays * DAY) : null;

  let dueByNow = D(0);
  if (end && input.today >= end) dueByNow = firstAmount;
  if (finalDue && input.today >= finalDue) dueByNow = held;
  const missing = Prisma.Decimal.max(D(0), dueByNow.minus(released));

  const fmt = (n: Prisma.Decimal) => `RM ${n.toDP(2).toNumber().toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let alert: string | null = null;
  if (missing.greaterThan(0)) {
    alert = finalDue && input.today >= finalDue
      ? `The defects liability period has ended. ${fmt(missing)} of retention is due to be released.`
      : `The contract has reached completion. ${fmt(missing)} of retention is due to be released.`;
  }
  return {
    rows,
    held: held.toDP(2).toNumber(),
    released: released.toDP(2).toNumber(),
    outstanding: outstanding.toDP(2).toNumber(),
    firstRelease: { amount: firstAmount.toNumber(), dueDate: end },
    finalRelease: { dueDate: finalDue },
    dueByNow: dueByNow.toDP(2).toNumber(),
    overdueRelease: missing.toDP(2).toNumber(),
    alert,
  };
}
