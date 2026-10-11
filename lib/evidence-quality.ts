export type QualityPhoto = { kind: string; latitude: number | null; longitude: number | null; trade: string | null; phase: string | null };
export type QualityCost = { reference: string | null };

export type EvidenceQuality = { percent: number | null; strong: number; total: number; photosMissingLocation: number; costsMissingReference: number };

/**
 * How well the record would stand up if challenged. A photo is strong with a GPS position, a trade and a phase;
 * a cost is strong with an invoice reference. It only ever nudges: nothing is blocked for being weak.
 */
export function evidenceQuality(photos: QualityPhoto[], costs: QualityCost[]): EvidenceQuality {
  const evidencePhotos = photos.filter((p) => p.kind !== "FLOORPLAN" && p.kind !== "SELECTION");
  const strongPhotos = evidencePhotos.filter((p) => p.latitude !== null && p.longitude !== null && !!p.trade && !!p.phase).length;
  const strongCosts = costs.filter((c) => !!c.reference?.trim()).length;
  const total = evidencePhotos.length + costs.length;
  const strong = strongPhotos + strongCosts;
  return {
    percent: total === 0 ? null : Math.round((strong / total) * 100),
    strong,
    total,
    photosMissingLocation: evidencePhotos.filter((p) => p.latitude === null || p.longitude === null).length,
    costsMissingReference: costs.length - strongCosts,
  };
}
