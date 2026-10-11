import { PHOTO_TRADES } from "./constants";

export type PunchGroupItem = { id: string; location: string; trade: string; description: string };
export type PunchGroup<T extends PunchGroupItem> = { trade: string; locations: { location: string; items: T[] }[] };

/**
 * Arrange punch items the way a closeout walk goes: by trade, then by place, so each person can be
 * walked through everything of theirs in one go. Trades follow the standard order; unknown ones come last.
 */
export function groupPunchItems<T extends PunchGroupItem>(items: T[]): PunchGroup<T>[] {
  const order = (trade: string) => {
    const index = (PHOTO_TRADES as readonly string[]).indexOf(trade);
    return index === -1 ? PHOTO_TRADES.length : index;
  };
  const trades = [...new Set(items.map((i) => i.trade))].sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  return trades.map((trade) => {
    const inTrade = items.filter((i) => i.trade === trade);
    const locations = [...new Set(inTrade.map((i) => i.location.trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return { trade, locations: locations.map((location) => ({ location, items: inTrade.filter((i) => i.location.trim() === location) })) };
  });
}
