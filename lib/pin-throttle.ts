import { prisma } from "@/lib/prisma";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;

export type Throttle = { failures: number; windowStart: Date; lockedUntil: Date | null } | null;

/** Pure rule: is this phone locked right now? */
export const isLocked = (t: Throttle, now: Date) => !!t?.lockedUntil && t.lockedUntil > now;

/** Pure rule: what the throttle becomes after one more wrong PIN. */
export function afterFailure(t: Throttle, now: Date): { failures: number; windowStart: Date; lockedUntil: Date | null } {
  const fresh = !t || now.getTime() - t.windowStart.getTime() > WINDOW_MS || (t.lockedUntil !== null && t.lockedUntil <= now);
  const failures = fresh ? 1 : t.failures + 1;
  return { failures, windowStart: fresh ? now : t!.windowStart, lockedUntil: failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null };
}

export const pinLocked = async (phone: string, now = new Date()) => isLocked(await prisma.pinThrottle.findUnique({ where: { phone } }), now);

export async function recordPinFailure(phone: string, now = new Date()) {
  const current = await prisma.pinThrottle.findUnique({ where: { phone } });
  const next = afterFailure(current, now);
  await prisma.pinThrottle.upsert({ where: { phone }, create: { phone, ...next }, update: next });
}

export async function clearPinFailures(phone: string) {
  await prisma.pinThrottle.deleteMany({ where: { phone } });
}
