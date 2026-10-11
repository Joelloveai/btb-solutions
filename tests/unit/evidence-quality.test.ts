import { describe, expect, it } from "vitest";
import { evidenceQuality } from "@/lib/evidence-quality";

const photo = (over = {}) => ({ kind: "PROGRESS", latitude: 3.1, longitude: 101.6, trade: "Tiling", phase: "Finishing", ...over });

describe("evidence quality", () => {
  it("has no score until something is recorded", () => {
    expect(evidenceQuality([], []).percent).toBeNull();
  });
  it("counts a photo strong only with GPS, trade and phase, and a cost strong only with a reference", () => {
    const q = evidenceQuality([photo(), photo({ latitude: null }), photo({ trade: null }), photo({ kind: "FLOORPLAN", latitude: null })], [{ reference: "INV-1" }, { reference: " " }, { reference: null }]);
    expect(q).toMatchObject({ strong: 2, total: 6, percent: 33, photosMissingLocation: 1, costsMissingReference: 2 });
  });
});
