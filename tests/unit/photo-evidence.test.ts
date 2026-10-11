import { describe, expect, it } from "vitest";
import { parsePhotoMetadata } from "@/lib/photo-metadata";
import { tradeTagFor } from "@/lib/trade-tag";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const parse = (fields: Record<string, string>) => parsePhotoMetadata(form(fields), NOW);

describe("parsePhotoMetadata", () => {
  it("keeps the phone's capture time, even when it syncs days later", () => {
    const r = parse({ capturedAt: "2026-10-08T03:15:00.000Z" });
    expect(r.ok && r.data.capturedAt?.toISOString()).toBe("2026-10-08T03:15:00.000Z");
  });

  it("ignores an impossible capture time instead of trusting it", () => {
    for (const bad of ["2026-10-12T08:00:00.000Z", "2020-01-01T00:00:00.000Z", "not a date"]) {
      const r = parse({ capturedAt: bad });
      expect(r.ok && r.data.capturedAt).toBeNull();
    }
  });

  it("tolerates a few minutes of clock drift", () => {
    const r = parse({ capturedAt: "2026-10-11T08:05:00.000Z" });
    expect(r.ok && r.data.capturedAt).not.toBeNull();
  });

  it("keeps GPS only as a complete, valid position", () => {
    const good = parse({ latitude: "3.139", longitude: "101.6869", accuracy: "12.4" });
    expect(good.ok && good.data).toMatchObject({ latitude: 3.139, longitude: 101.6869, accuracy: 12.4 });
    const half = parse({ latitude: "3.139" });
    expect(half.ok && half.data).toMatchObject({ latitude: null, longitude: null, accuracy: null });
    const outOfRange = parse({ latitude: "95", longitude: "101" });
    expect(outOfRange.ok && outOfRange.data.latitude).toBeNull();
  });

  it("accepts the real tags and refuses made-up ones", () => {
    expect(parse({ trade: "M&E", phase: "Pre-cover", checklistItem: "REBAR" }).ok).toBe(true);
    expect(parse({ trade: "Wizardry" })).toEqual({ ok: false, error: "Unknown trade." });
    expect(parse({ phase: "Someday" })).toEqual({ ok: false, error: "Unknown phase." });
    expect(parse({ checklistItem: "NOPE" })).toEqual({ ok: false, error: "Unknown checklist item." });
  });

  it("treats everything as optional", () => {
    const r = parse({});
    expect(r.ok && r.data).toEqual({ capturedAt: null, latitude: null, longitude: null, accuracy: null, trade: null, phase: null, location: null, checklistItem: null });
  });
});

describe("tradeTagFor", () => {
  it("maps a subcontractor's free-text trade onto the fixed tags", () => {
    expect(tradeTagFor("Plumbing")).toBe("Plumbing");
    expect(tradeTagFor("Ah Seng Electrical")).toBe("Electrical");
    expect(tradeTagFor("plumber")).toBe("Plumbing");
    expect(tradeTagFor("Air-con installer")).toBe("M&E");
    expect(tradeTagFor("Tiling & flooring")).toBe("Tiling");
    expect(tradeTagFor("Landscaping")).toBe("Other");
    expect(tradeTagFor(null)).toBe("Other");
  });
});

import { groupPunchItems } from "@/lib/punch";

describe("groupPunchItems", () => {
  const item = (id: string, trade: string, location: string) => ({ id, trade, location, description: id });
  it("groups by trade in the standard order, then by place in natural order", () => {
    const groups = groupPunchItems([
      item("a", "Painting", "Level 10, Unit 2"),
      item("b", "Plumbing", "Level 3, Unit 12"),
      item("c", "Painting", "Level 2, Unit 5"),
      item("d", "Painting", "Level 2, Unit 5"),
      item("e", "Mystery trade", "Roof"),
    ]);
    expect(groups.map((g) => g.trade)).toEqual(["Plumbing", "Painting", "Mystery trade"]);
    const painting = groups.find((g) => g.trade === "Painting")!;
    expect(painting.locations.map((l) => l.location)).toEqual(["Level 2, Unit 5", "Level 10, Unit 2"]);
    expect(painting.locations[0]!.items.map((i) => i.id)).toEqual(["c", "d"]);
  });
  it("ignores stray spaces when matching places", () => {
    const [group] = groupPunchItems([item("a", "Tiling", "Kitchen "), item("b", "Tiling", "Kitchen")]);
    expect(group!.locations).toHaveLength(1);
  });
});
