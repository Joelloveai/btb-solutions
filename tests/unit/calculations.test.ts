import { describe, expect, it } from "vitest";
import { calculateTotals } from "@/lib/calculations";
import { formatRM } from "@/lib/format";
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

describe("formatRM", () => {
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
