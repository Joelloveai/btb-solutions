import { describe, expect, it } from "vitest";
import { calculateTotals } from "@/lib/calculations";
import { formatRM } from "@/lib/format";
import { computeClaim, claimBalance } from "@/lib/claims";
import { calculateQuote } from "@/lib/quotes";
import { ageBucket, daysOverdue } from "@/lib/receivables";
import { summarizeProject } from "@/lib/project-summary";
import { changeOrderSchema, costSchema, projectSchema } from "@/lib/validators";

describe("calculateTotals", () => {
  it("matches the worked example from the spec", () => {
    const totals = calculateTotals({
      contractValue: "150000",
      costs: [{ amount: "2500" }],
      payments: [{ amount: "30000" }],
      changeOrders: [],
    });
    expect(totals.totalCosts).toBe(2500);
    expect(totals.totalPayments).toBe(30000);
    expect(totals.outstandingBalance).toBe(120000);
    expect(totals.profitLoss).toBe(147500);
  });

  it("counts only approved change orders", () => {
    const totals = calculateTotals({
      contractValue: "100000",
      costs: [],
      payments: [],
      changeOrders: [
        { amount: "5000", status: "APPROVED" },
        { amount: "9000", status: "PENDING" },
        { amount: "7000", status: "REJECTED" },
        { amount: "-1000", status: "APPROVED" },
      ],
    });
    expect(totals.approvedChangeOrders).toBe(4000);
    expect(totals.revisedContractValue).toBe(104000);
  });

  it("does not drift on decimals", () => {
    const totals = calculateTotals({
      contractValue: "1",
      costs: [{ amount: "0.1" }, { amount: "0.2" }],
      payments: [],
      changeOrders: [],
    });
    expect(totals.totalCosts).toBe(0.3);
  });

  it("reports a loss as negative", () => {
    const totals = calculateTotals({
      contractValue: "1000",
      costs: [{ amount: "1500.50" }],
      payments: [],
      changeOrders: [],
    });
    expect(totals.profitLoss).toBe(-500.5);
  });
});

describe("SST", () => {
  it("adds 6% of the revised contract to what is owed, but not to profit", () => {
    const totals = calculateTotals({
      contractValue: "100000",
      costs: [{ amount: "20000" }],
      payments: [{ amount: "30000" }],
      changeOrders: [{ amount: "5000", status: "APPROVED" }],
      sstEnabled: true,
      sstRate: "6.00",
    });
    expect(totals.sstAmount).toBe(6300);
    expect(totals.billableTotal).toBe(111300);
    expect(totals.outstandingBalance).toBe(81300);
    expect(totals.profitLoss).toBe(85000);
  });

  it("is zero when disabled", () => {
    const totals = calculateTotals({
      contractValue: "100000",
      costs: [],
      payments: [],
      changeOrders: [],
      sstEnabled: false,
      sstRate: "6.00",
    });
    expect(totals.sstAmount).toBe(0);
    expect(totals.billableTotal).toBe(100000);
  });
});

describe("formatRM", () => {
  it("formats the same way for the Malay locale", () => {
    expect(formatRM(1234.5, "ms")).toBe("RM 1,234.50");
  });

  it("formats with thousands separators and 2 decimals", () => {
    expect(formatRM(1234.5)).toBe("RM 1,234.50");
    expect(formatRM(0)).toBe("RM 0.00");
    expect(formatRM(-500.5)).toBe("-RM 500.50");
  });
});

describe("validators", () => {
  it("rejects a zero contract value", () => {
    expect(projectSchema.safeParse({ name: "X", contractValue: "0" }).success).toBe(false);
  });
  it("rejects amounts with 3 decimals", () => {
    const result = costSchema.safeParse({
      date: "2026-10-08",
      category: "MATERIAL",
      description: "x",
      amount: "1.234",
    });
    expect(result.success).toBe(false);
  });
  it("allows negative change orders but not zero", () => {
    const base = { date: "2026-10-08", description: "Omit tiling" };
    expect(changeOrderSchema.safeParse({ ...base, amount: "-800" }).success).toBe(true);
    expect(changeOrderSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });
});

describe("computeClaim", () => {
  it("holds retention back from the work done and adds SST on top", () => {
    const c = computeClaim({ workDone: "50000", retentionPercent: "5", sstEnabled: true, sstRate: "6", previousClaimed: "10000" });
    expect(c.sstAmount).toBe(3000);
    expect(c.amountClaimed).toBe(53000);
    expect(c.retentionAmount).toBe(2500);
    expect(c.netClaim).toBe(50500);
  });
  it("skips SST when the project has none", () => {
    const c = computeClaim({ workDone: "1000.10", retentionPercent: "5", sstEnabled: false, sstRate: "6", previousClaimed: 0 });
    expect(c.sstAmount).toBe(0);
    expect(c.netClaim).toBe(950.09);
  });
  it("works out the balance left on a claim", () => {
    expect(claimBalance("50500", [{ amount: "20000" }, { amount: "500.50" }])).toEqual({ paid: 20500.5, balance: 29999.5 });
  });
});

describe("calculateQuote", () => {
  it("multiplies qty by price per line and adds SST to the subtotal", () => {
    const q = calculateQuote([{ qty: "2.5", unitPrice: "100.10" }, { qty: "10", unitPrice: "5" }], true, 6);
    expect(q.lineAmounts).toEqual([250.25, 50]);
    expect(q.subtotal).toBe(300.25);
    expect(q.sst).toBe(18.02);
    expect(q.total).toBe(318.27);
  });
});

describe("receivables aging", () => {
  const issued = new Date("2026-08-01T00:00:00Z");
  it("is not overdue until the payment terms have passed", () => {
    expect(daysOverdue(issued, new Date("2026-08-31T00:00:00Z"), 30)).toBe(0);
    expect(daysOverdue(issued, new Date("2026-09-10T00:00:00Z"), 30)).toBe(10);
  });
  it("buckets by days overdue", () => {
    expect([0, 30, 31, 60, 61, 90, 91].map(ageBucket)).toEqual([
      "current", "current", "late", "late", "overdue", "overdue", "critical",
    ]);
  });
});

describe("summarizeProject", () => {
  it("keeps SST and double-counted subcon owed out of real profit", () => {
    const s = summarizeProject({
      contractValue: "100000",
      sstEnabled: true,
      sstRate: "6",
      costs: [
        { amount: "20000", category: "SUBCON", paidAt: null },
        { amount: "10000", category: "SUBCON", paidAt: new Date() },
        { amount: "5000", category: "MATERIAL" },
      ],
      payments: [],
      changeOrders: [{ amount: "10000", status: "APPROVED" }],
      claims: [{ amountClaimed: "30000", retentionAmount: "1500" }],
      retentionReleased: "500",
    });
    expect(s.subconOwed).toBe(20000);
    expect(s.realProfit).toBe(75000);
    expect(s.retentionOutstanding).toBe(1000);
    expect(s.claimsIssued).toBe(30000);
  });
});
