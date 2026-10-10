import { describe, expect, it } from "vitest";
import { completionPercent, toGanttTasks } from "@/lib/gantt";
import { detectImageType } from "@/lib/photos";
import { reminderLink, whatsappNumber } from "@/lib/whatsapp";

describe("whatsappNumber", () => {
  it("turns Malaysian numbers typed any way into international digits", () => {
    expect(whatsappNumber("012-345 6789")).toBe("60123456789");
    expect(whatsappNumber("+60 12 345 6789")).toBe("60123456789");
    expect(whatsappNumber("0060123456789")).toBe("60123456789");
    expect(whatsappNumber("60123456789")).toBe("60123456789");
  });
  it("returns null when there is nothing usable", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber("call Ah Seng")).toBeNull();
  });
});

describe("reminderLink", () => {
  it("builds a wa.me link with the task and a link back to the task page", () => {
    const link = reminderLink({ phone: "012-345 6789", name: "Mutu", task: "Fix pipes & taps", project: "Cheras", due: "31 Dec 2026", appUrl: "https://app.example" });
    expect(link?.startsWith("https://wa.me/60123456789?text=")).toBe(true);
    const text = decodeURIComponent(link!.split("text=")[1]!);
    expect(text).toContain("Fix pipes & taps");
    expect(text).toContain("https://app.example/sub/tasks");
  });
  it("is null without a phone number", () => {
    expect(reminderLink({ phone: null, name: "x", task: "t", project: "p", due: "d", appUrl: "u" })).toBeNull();
  });
});

describe("gantt mapping", () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  it("spans start to due inclusive, and marks done tasks complete", () => {
    const [t] = toGanttTasks([{ id: "1", description: "Slab", startDate: d("2026-10-01"), dueDate: d("2026-10-05"), isMilestone: false, status: "DONE" }]);
    expect(t).toMatchObject({ start_date: "2026-10-01", duration: 5, progress: 1, type: "task" });
  });
  it("uses a one-day bar when there is no start date, and a marker for milestones", () => {
    const [bar, ms] = toGanttTasks([
      { id: "1", description: "A", startDate: null, dueDate: d("2026-10-05"), isMilestone: false, status: "OPEN" },
      { id: "2", description: "Keys", startDate: d("2026-10-01"), dueDate: d("2026-11-30"), isMilestone: true, status: "OPEN" },
    ]);
    expect(bar).toMatchObject({ start_date: "2026-10-05", duration: 1, progress: 0 });
    expect(ms).toMatchObject({ start_date: "2026-11-30", duration: 0, type: "milestone" });
  });
  it("computes completion from done tasks, or null with no tasks", () => {
    expect(completionPercent([])).toBeNull();
    expect(completionPercent([{ status: "DONE" }, { status: "OPEN" }, { status: "OPEN" }])).toBe(33);
  });
});

describe("detectImageType", () => {
  it("recognises real images by their bytes", () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("refuses SVG, HTML and anything else, whatever the file is called", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectImageType(new Uint8Array(0))).toBeNull();
  });
});
