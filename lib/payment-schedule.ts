import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal.Value;

export type MilestoneInput = { id: string; label: string; percent: Money; dueDate: Date | null };
export type MilestoneStatus = "PAID" | "PART_PAID" | "OUTSTANDING";
export type MilestoneResult = {
  id: string;
  label: string;
  percent: number;
  amount: number;
  paid: number;
  status: MilestoneStatus;
  overdue: boolean;
  dueDate: Date | null;
};

/**
 * Work out each instalment's amount and whether it has been paid, from what has actually been received.
 * Money received fills the instalments in order: the first one up to its amount, then the next, and so on.
 * So nothing is entered twice: record a payment once and the schedule follows.
 * `total` is what the client is billed in all (contract + approved variations + SST).
 */
export function buildPaymentSchedule(milestones: MilestoneInput[], total: Money, received: Money, today: Date): MilestoneResult[] {
  let remaining = new Prisma.Decimal(received);
  return milestones.map((m) => {
    const amount = new Prisma.Decimal(total).times(m.percent).dividedBy(100).toDP(2);
    const paid = Prisma.Decimal.min(Prisma.Decimal.max(remaining, 0), amount);
    remaining = remaining.minus(paid);
    const status: MilestoneStatus = paid.greaterThanOrEqualTo(amount) ? "PAID" : paid.greaterThan(0) ? "PART_PAID" : "OUTSTANDING";
    return {
      id: m.id,
      label: m.label,
      percent: new Prisma.Decimal(m.percent).toNumber(),
      amount: amount.toNumber(),
      paid: paid.toDP(2).toNumber(),
      status,
      overdue: status !== "PAID" && !!m.dueDate && m.dueDate.getTime() < today.getTime(),
      dueDate: m.dueDate,
    };
  });
}
