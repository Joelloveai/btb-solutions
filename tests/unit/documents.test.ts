import { describe, expect, it } from "vitest";
import { detectDocumentType, documentNameKey, safeDownloadName } from "@/lib/document-files";

const bytes = (...values: number[]) => Uint8Array.from(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("detectDocumentType", () => {
  it("recognises the allowed files by their bytes", () => {
    expect(detectDocumentType(text("%PDF-1.7\n"), "plan.pdf")).toMatchObject({ mime: "application/pdf", ext: "pdf", inline: true });
    expect(detectDocumentType(bytes(0xff, 0xd8, 0xff, 0xe0), "a.jpg")?.ext).toBe("jpg");
    expect(detectDocumentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0), "a.png")?.ext).toBe("png");
    expect(detectDocumentType(text("AC1032\0\0"), "site.dwg")).toMatchObject({ ext: "dwg", inline: false });
  });

  it("only accepts a zip as Word or Excel when the name says so too", () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);
    expect(detectDocumentType(zip, "Spec.DOCX")?.ext).toBe("docx");
    expect(detectDocumentType(zip, "boq.xlsx")?.ext).toBe("xlsx");
    expect(detectDocumentType(zip, "archive.zip")).toBeNull();
    expect(detectDocumentType(zip, "tool.exe")).toBeNull();
  });

  it("refuses scripts and pages dressed up as drawings", () => {
    expect(detectDocumentType(text("<html><script>alert(1)</script>"), "plan.pdf")).toBeNull();
    expect(detectDocumentType(text("<svg xmlns='http://www.w3.org/2000/svg'/>"), "plan.png")).toBeNull();
    expect(detectDocumentType(new Uint8Array(0), "empty.pdf")).toBeNull();
  });

  it("only offers PDFs and images to be shown in the browser; everything else is a download", () => {
    expect(detectDocumentType(text("%PDF-"), "a.pdf")?.inline).toBe(true);
    expect(detectDocumentType(text("AC10"), "a.dwg")?.inline).toBe(false);
  });
});

describe("document names", () => {
  it("treats case and stray spaces as the same document", () => {
    expect(documentNameKey("  Ground  Floor Plan ")).toBe(documentNameKey("ground floor plan"));
    expect(documentNameKey("Ground floor plan")).not.toBe(documentNameKey("First floor plan"));
  });
  it("makes a download name that is safe and ends in the right extension", () => {
    expect(safeDownloadName('Plan: "A/B" v2', "pdf")).toBe("Plan_ _A_B_ v2.pdf");
    expect(safeDownloadName("Plan.pdf", "pdf")).toBe("Plan.pdf");
    expect(safeDownloadName("", "pdf")).toBe("document.pdf");
  });
});

import { dailySummary, dueBucket } from "@/lib/schedule";

describe("dueBucket", () => {
  const today = new Date("2026-10-11T00:00:00.000Z");
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000);
  it("sorts due dates into overdue, today, this week and later", () => {
    expect([-30, -1, 0, 1, 6, 7, 40].map((n) => dueBucket(day(n), today))).toEqual(["overdue", "overdue", "today", "week", "week", "later", "later"]);
  });
});

describe("dailySummary", () => {
  const today = new Date("2026-10-11T00:00:00.000Z");
  const now = new Date("2026-10-11T03:00:00.000Z");
  const day = (n: number) => new Date(today.getTime() + n * 86_400_000);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it("counts what is new in the last day, what is due tomorrow, and what is overdue, across tasks and punch items", () => {
    const tasks = [
      { status: "OPEN", createdAt: hoursAgo(2), dueDate: day(1) }, // new, due tomorrow
      { status: "OPEN", createdAt: hoursAgo(80), dueDate: day(-2) }, // old, overdue
      { status: "DONE", createdAt: hoursAgo(1), dueDate: day(-1) }, // done: never counts
    ];
    const punch = [
      { status: "OPEN", createdAt: hoursAgo(5), dueDate: day(1) }, // new, due tomorrow
      { status: "OPEN", createdAt: hoursAgo(200), dueDate: null }, // old, no date
      { status: "CLOSED", createdAt: hoursAgo(1), dueDate: day(-5) },
    ];
    expect(dailySummary(tasks, punch, now, today)).toEqual({ newTasks: 1, dueTomorrow: 2, overdue: 1, newPunch: 1 });
  });
});
