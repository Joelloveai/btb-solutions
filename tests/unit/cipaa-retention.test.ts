import { describe, expect, it } from "vitest";
import { agingTotals, bandOf, cipaaCountdown, cipaaStage, daysSince } from "@/lib/cipaa";
import { retentionReport } from "@/lib/retention";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("CIPAA clock", () => {
  it("counts days and bands them", () => {
    expect(daysSince(d("2026-09-01"), d("2026-10-01"))).toBe(30);
    expect([0, 30, 31, 60, 61, 90, 91].map(bandOf)).toEqual(["0-30", "0-30", "31-60", "31-60", "61-90", "61-90", "90+"]);
  });
  it("totals only unpaid claims per band", () => {
    expect(agingTotals([{ days: 10, balance: 100.1 }, { days: 20, balance: 50.2 }, { days: 45, balance: 10 }, { days: 120, balance: 5 }, { days: 70, balance: 0 }])).toEqual({ "0-30": 150.3, "31-60": 10, "61-90": 0, "90+": 5 });
  });
  it("moves to a payment response at 30 days and adjudication at 60", () => {
    expect([29, 30, 59, 60].map((n) => cipaaStage(n, true))).toEqual(["WITHIN_TERMS", "PAYMENT_RESPONSE", "PAYMENT_RESPONSE", "ADJUDICATION"]);
    expect(cipaaStage(90, false)).toBe("WITHIN_TERMS");
    expect(cipaaCountdown(25, true)).toBe("Payment response notice in 5 days");
    expect(cipaaCountdown(59, true)).toBe("Notice of adjudication in 1 day");
    expect(cipaaCountdown(75, true)).toBe("15 days past the adjudication threshold");
  });
});

describe("retention tracker", () => {
  const base = { claims: [{ number: 2, retentionAmount: "3000.00" }, { number: 1, retentionAmount: "2000.50" }], contractValue: "200000", releasePercent: "2.5", defectsLiabilityDays: 365 };
  it("shows held per claim and cumulative, then outstanding", () => {
    const r = retentionReport({ ...base, released: "0", contractEndDate: null, today: d("2026-10-13") });
    expect(r.rows).toEqual([{ number: 1, held: 2000.5, cumulative: 2000.5 }, { number: 2, held: 3000, cumulative: 5000.5 }]);
    expect([r.held, r.released, r.outstanding]).toEqual([5000.5, 0, 5000.5]);
    expect(r.alert).toBeNull();
  });
  it("alerts when the completion release is due and not yet paid, then the final one", () => {
    const before = retentionReport({ ...base, released: "0", contractEndDate: d("2026-12-01"), today: d("2026-11-30") });
    expect(before.alert).toBeNull();
    const atEnd = retentionReport({ ...base, released: "0", contractEndDate: d("2026-12-01"), today: d("2026-12-01") });
    expect(atEnd.firstRelease.amount).toBe(5000); // 2.5% of 200,000
    expect(atEnd.alert).toContain("RM 5,000.00");
    const paid = retentionReport({ ...base, released: "5000", contractEndDate: d("2026-12-01"), today: d("2026-12-02") });
    expect(paid.alert).toBeNull();
    const final = retentionReport({ ...base, released: "5000", contractEndDate: d("2026-12-01"), today: d("2027-12-02") });
    expect(final.overdueRelease).toBe(0.5);
    expect(final.alert).toContain("defects liability period has ended");
  });
  it("never asks to release more than is held", () => {
    const r = retentionReport({ ...base, contractValue: "10000000", released: "0", contractEndDate: d("2026-01-01"), today: d("2026-02-01") });
    expect(r.firstRelease.amount).toBe(5000.5);
  });
});

import { boqClaimLine, claimNumberFor, projectCode } from "@/lib/claims";

describe("claim numbering and BOQ billing", () => {
  it("makes PROJECTCODE/YYYY/CLM/SEQ", () => {
    expect(projectCode("Taman Sri Petaling Reno")).toBe("TSPR");
    expect(projectCode("Renovation")).toBe("RENO");
    expect(projectCode("   ")).toBe("PRJ");
    expect(claimNumberFor("TSPR", d("2026-10-13"), 3)).toBe("TSPR/2026/CLM/003");
  });
  it("bills only what is done and not yet claimed, at the item's rate", () => {
    const line = { description: "Tiling", unit: "m2", qty: "100", rate: "45.50", completedQuantity: "60", claimedQuantity: "25" };
    const l = boqClaimLine(line)!;
    expect([l.quantity.toString(), l.currentAmount.toFixed(2), l.previousAmount.toFixed(2), l.amount.toFixed(2)]).toEqual(["35", "1592.50", "1137.50", "2730.00"]);
    expect(boqClaimLine({ ...line, completedQuantity: "25" })).toBeNull();
  });
});
