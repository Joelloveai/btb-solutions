import { Prisma } from "@prisma/client";

type Money = Prisma.Decimal.Value;
const D = (v: Money) => new Prisma.Decimal(v);

export type QuoteTotals = {
  lineAmounts: number[];
  subtotal: number;
  sst: number;
  total: number;
};

/** Each line is Qty x Unit Price rounded to sen; SST is charged on the subtotal. */
export function calculateQuote(
  lines: { qty: Money; unitPrice: Money }[],
  sstEnabled: boolean,
  sstRate: Money = 6,
): QuoteTotals {
  const amounts = lines.map((l) => D(l.qty || 0).times(D(l.unitPrice || 0)).toDP(2));
  const subtotal = amounts.reduce((t, a) => t.plus(a), D(0));
  const sst = sstEnabled ? subtotal.times(sstRate).dividedBy(100).toDP(2) : D(0);
  return {
    lineAmounts: amounts.map((a) => a.toNumber()),
    subtotal: subtotal.toNumber(),
    sst: sst.toNumber(),
    total: subtotal.plus(sst).toNumber(),
  };
}

export const quoteNumber = (n: number) => `Q-${String(n).padStart(4, "0")}`;
