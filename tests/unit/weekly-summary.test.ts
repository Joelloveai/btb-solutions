import { describe, expect, it } from "vitest";
import { digestText, lastSundaySixPm } from "@/lib/weekly-summary";

describe("lastSundaySixPm (Malaysia time)", () => {
  // Sunday 11 Oct 2026, 18:00 in KL is 10:00 UTC.
  const boundary = "2026-10-11T10:00:00.000Z";
  it("is that Sunday's 6pm once it has passed", () => {
    expect(lastSundaySixPm(new Date("2026-10-11T10:00:00Z")).toISOString()).toBe(boundary);
    expect(lastSundaySixPm(new Date("2026-10-13T03:00:00Z")).toISOString()).toBe(boundary); // Tuesday
    expect(lastSundaySixPm(new Date("2026-10-18T09:59:00Z")).toISOString()).toBe(boundary); // next Sunday, just before 6pm
  });
  it("is the week before when Sunday 6pm has not come yet", () => {
    expect(lastSundaySixPm(new Date("2026-10-11T09:59:00Z")).toISOString()).toBe("2026-10-04T10:00:00.000Z");
  });
  it("uses Malaysian dates: Sunday 01:00 KL is still Saturday in UTC", () => {
    expect(lastSundaySixPm(new Date("2026-10-10T17:00:00Z")).toISOString()).toBe("2026-10-04T10:00:00.000Z");
  });
});

describe("digestText", () => {
  it("reads in plain words", () => {
    expect(digestText({ photos: 14, tasksDone: 3, nextWeekDue: 5, percent: 62 })).toBe("This week: 14 photos, 3 tasks completed. Next week: 5 tasks are due. You are 62% complete.");
    expect(digestText({ photos: 1, tasksDone: 1, nextWeekDue: 1, percent: null })).toBe("This week: 1 photo, 1 task completed. Next week: 1 task is due.");
    expect(digestText({ photos: 0, tasksDone: 0, nextWeekDue: 0, percent: 0 })).toContain("nothing is scheduled yet");
  });
});
