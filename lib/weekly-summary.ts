const KL_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8 all year
const WEEK = 7 * 86_400_000;

/** The most recent Sunday 6pm in Malaysia that has already happened (as a real instant). */
export function lastSundaySixPm(now: Date): Date {
  const local = new Date(now.getTime() + KL_OFFSET_MS); // read UTC fields as KL wall-clock
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  let sunday = dayStart - local.getUTCDay() * 86_400_000 + 18 * 3_600_000;
  if (sunday > local.getTime()) sunday -= WEEK;
  return new Date(sunday - KL_OFFSET_MS);
}

export const weekStartOf = (weekEnding: Date) => new Date(weekEnding.getTime() - WEEK);

/** The message the homeowner reads: plain words, no money, no names of subcontractors. */
export function digestText(input: { photos: number; tasksDone: number; nextWeekDue: number; percent: number | null }): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const next = input.nextWeekDue === 0 ? "nothing is scheduled yet" : `${plural(input.nextWeekDue, "task is", "tasks are")} due`;
  const done = input.percent === null ? "" : ` You are ${input.percent}% complete.`;
  return `This week: ${plural(input.photos, "photo", "photos")}, ${plural(input.tasksDone, "task", "tasks")} completed. Next week: ${next}.${done}`;
}
