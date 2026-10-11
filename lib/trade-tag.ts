import { PHOTO_TRADES, type PhotoTrade } from "./constants";

const HINTS: [RegExp, PhotoTrade][] = [
  [/struct|rebar|concrete|steel|piling|foundation/i, "Structural"],
  [/m\s*&\s*e|mech|hvac|air.?con|ventilat|fire|sprinkler/i, "M&E"],
  [/plumb|pipe|sanit|drain/i, "Plumbing"],
  [/electric|wiring|cable|lighting/i, "Electrical"],
  [/tile|tiling|floor|granite/i, "Tiling"],
  [/paint|coat|plaster/i, "Painting"],
  [/carpent|timber|wood|cabinet|joiner|door|ceiling/i, "Carpentry"],
];

/**
 * A subcontractor's trade is free text ("Ah Seng Electrical", "plumber"). Map it onto the fixed trade
 * tags so their drawings and photos can be filtered; anything unrecognised is "Other".
 */
export function tradeTagFor(text: string | null | undefined): PhotoTrade {
  if (!text) return "Other";
  const exact = PHOTO_TRADES.find((t) => t.toLowerCase() === text.trim().toLowerCase());
  if (exact) return exact;
  return HINTS.find(([pattern]) => pattern.test(text))?.[1] ?? "Other";
}
