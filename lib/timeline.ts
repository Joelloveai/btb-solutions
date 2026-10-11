import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { TimelineEventType } from "@/lib/constants";
import { formatRM } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

export type Actor = { id: string | null; role: "staff" | "sub" | "client" | "system"; name: string | null };

export type NewEvent = {
  projectId: string;
  type: TimelineEventType;
  actor: Actor;
  title: string;
  description?: string | null;
  /** Small, flat facts about the event (ids, amounts, what changed). Stored as JSON text and covered by the hash. */
  metadata?: Record<string, string | number | boolean | null>;
  latitude?: number | null;
  longitude?: number | null;
  /** When it happened on the device (offline captures); defaults to now. */
  capturedAt?: Date;
  /** Request id of an offline submission, so a retry is recognised. */
  clientRequestId?: string | null;
};

type HashInput = {
  projectId: string;
  seq: number;
  eventType: string;
  actorId: string | null;
  actorRole: string;
  title: string;
  description: string | null;
  metadata: string;
  latitude: number | null;
  longitude: number | null;
  capturedAt: Date;
  createdAt: Date;
  previousHash: string | null;
};

/** SHA-256 over every content field, in a fixed order, plus the previous event's hash. */
export function hashEvent(e: HashInput): string {
  const canonical = JSON.stringify([
    e.projectId,
    e.seq,
    e.eventType,
    e.actorId,
    e.actorRole,
    e.title,
    e.description,
    e.metadata,
    e.latitude,
    e.longitude,
    e.capturedAt.toISOString(),
    e.createdAt.toISOString(),
    e.previousHash,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Add an event to a project's chain. Call it inside the same transaction as the change it records,
 * so a change and its record succeed or fail together.
 */
export async function appendEvent(tx: Tx, event: NewEvent) {
  const last = await tx.timelineEvent.findFirst({
    where: { projectId: event.projectId },
    orderBy: { seq: "desc" },
    select: { seq: true, hash: true },
  });
  const now = new Date();
  const base: HashInput = {
    projectId: event.projectId,
    seq: (last?.seq ?? 0) + 1,
    eventType: event.type,
    actorId: event.actor.id,
    actorRole: event.actor.role,
    title: event.title.slice(0, 200),
    description: event.description?.trim() ? event.description.trim().slice(0, 2000) : null,
    metadata: JSON.stringify(event.metadata ?? {}),
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    capturedAt: event.capturedAt && event.capturedAt.getTime() <= now.getTime() + 5 * 60_000 ? event.capturedAt : now,
    createdAt: now,
    previousHash: last?.hash ?? null,
  };
  return tx.timelineEvent.create({ data: { ...base, actorName: event.actor.name, clientRequestId: event.clientRequestId ?? null, hash: hashEvent(base) } });
}

/** Two writers racing for the same sequence number: the loser simply starts over. */
const isChainRace = (error: unknown) =>
  (error instanceof Prisma.PrismaClientKnownRequestError &&
    ((error.code === "P2002" && String(error.meta?.target ?? "").includes("seq")) || error.code === "P2034")) ||
  (error instanceof Error && /database is locked|SQLITE_BUSY/i.test(error.message));

/** Run a change and its timeline event(s) as one transaction, retrying if another writer took the next sequence number. */
export async function recorded<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work);
    } catch (error) {
      if (attempt >= 5 || !isChainRace(error)) throw error;
    }
  }
}

export type ChainCheck =
  | { ok: true; count: number; head: string | null }
  | { ok: false; count: number; brokenAtSeq: number; reason: string };

/** Recompute every hash in order. The first event that does not match (or whose link is missing) is reported. */
export function verifyChain(
  events: { projectId: string; seq: number; eventType: string; actorId: string | null; actorRole: string; title: string; description: string | null; metadata: string; latitude: number | null; longitude: number | null; capturedAt: Date; createdAt: Date; hash: string; previousHash: string | null }[],
): ChainCheck {
  let prev: string | null = null;
  let expectedSeq = 1;
  for (const e of events) {
    if (e.seq !== expectedSeq) return { ok: false, count: events.length, brokenAtSeq: expectedSeq, reason: "An event is missing from the sequence." };
    if (e.previousHash !== prev) return { ok: false, count: events.length, brokenAtSeq: e.seq, reason: "This event does not follow the one before it." };
    if (hashEvent(e) !== e.hash) return { ok: false, count: events.length, brokenAtSeq: e.seq, reason: "This event's content no longer matches its fingerprint." };
    prev = e.hash;
    expectedSeq++;
  }
  return { ok: true, count: events.length, head: prev };
}

export async function verifyProjectChain(projectId: string): Promise<ChainCheck> {
  return verifyChain(await prisma.timelineEvent.findMany({ where: { projectId }, orderBy: { seq: "asc" } }));
}

/** "RM 1,234.56" for titles; accepts the Decimal, string or number a form or row gives us. */
export const rm = (value: { toString(): string } | number | string) => formatRM(Number(value.toString()));
