import { PAYMENT_TERMS_DAYS } from "./company-config";

const DAY = 24 * 60 * 60 * 1000;

export type AgeBucket = "current" | "late" | "overdue" | "critical";

/** Whole days past the due date (issue date + payment terms); 0 until the claim is due. */
export function daysOverdue(issued: Date, today: Date, terms = PAYMENT_TERMS_DAYS): number {
  const due = issued.getTime() + terms * DAY;
  return Math.max(0, Math.floor((today.getTime() - due) / DAY));
}

/** 0-30 green, 31-60 amber, 61-90 orange, 90+ red. */
export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return "current";
  if (days <= 60) return "late";
  if (days <= 90) return "overdue";
  return "critical";
}

export const BUCKET_STYLES: Record<AgeBucket, string> = {
  current: "bg-profit-light text-profit-dark",
  late: "bg-pending-light text-pending-dark",
  overdue: "bg-orange-100 text-orange-800",
  critical: "bg-loss-light text-loss-dark",
};
