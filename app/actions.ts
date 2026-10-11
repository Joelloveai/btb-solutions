"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireClient, requireSession, requireSub } from "@/lib/auth";
import { deletePhotoFile } from "@/lib/photos";
import { computeClaim } from "@/lib/claims";
import { PROJECT_STAGES } from "@/lib/constants";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "node:crypto";
import { saveDocumentFile, deleteDocumentFile } from "@/lib/document-storage";
import { buildDiaryPdf, decodeSignature, diaryContentHash, newPdfKey, pdfIdFromKey, signatureHash } from "@/lib/site-diary";
import { appendEvent, recorded, rm } from "@/lib/timeline";
import { actorFromSession } from "@/lib/timeline-actor";
import { calculateQuote } from "@/lib/quotes";
import {
  boqLineSchema,
  changeOrderSchema,
  claimSchema,
  dailyLogSchema,
  diarySchema,
  loginUserSchema,
  milestoneSchema,
  punchSchema,
  selectionSchema,
  taskSchema,
  clientSchema,
  paidDateSchema,
  quoteSchema,
  quoteStatusSchema,
  releaseRetentionSchema,
  subcontractorSchema,
  changeOrderStatusSchema,
  costSchema,
  paymentSchema,
  projectSchema,
} from "@/lib/validators";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const orNull = (value?: string) => (value && value.trim() ? value.trim() : null);


/**
 * Offline-capable clients tag each submission with an id and re-send the SAME id when they retry
 * (for example after a response was lost). A unique column turns the repeat into a no-op.
 */
const requestIdOf = (id?: string) => (id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null);
const alreadyApplied = (error: unknown, requestId: string | null) =>
  !!requestId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Money now flows between pages (claims, receivables, clients, subcons), so refresh them all. */
const revalidateAll = () => revalidatePath("/", "layout");

function failure(error: unknown): ActionResult<never> {
  if (error instanceof Error && error.message === "Not signed in") {
    return { ok: false, error: "Please sign in again." };
  }
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function findClient(id?: string) {
  return id ? prisma.client.findUnique({ where: { id } }) : null;
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const client = await findClient(v.clientId);
    const project = await prisma.project.create({
      data: {
        name: v.name,
        clientId: client?.id ?? null,
        clientName: client?.name ?? null,
        contractValue: v.contractValue,
        startDate: v.startDate ? toDate(v.startDate) : null,
        sstEnabled: v.sstEnabled,
        retentionPercent: v.retentionPercent,
        contractRef: orNull(v.contractRef),
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    return { ok: true, data: { id: project.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateProject(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const client = await findClient(v.clientId);
    const existing = await prisma.project.findUniqueOrThrow({ where: { id } });
    // No client picked: unlink a linked project, but keep the typed name on an old unlinked one.
    const clientData = client
      ? { clientId: client.id, clientName: client.name }
      : existing.clientId
        ? { clientId: null, clientName: null }
        : {};
    await prisma.project.update({
      where: { id },
      data: {
        name: v.name,
        ...clientData,
        contractValue: v.contractValue,
        startDate: v.startDate ? toDate(v.startDate) : null,
        sstEnabled: v.sstEnabled,
        retentionPercent: v.retentionPercent,
        contractRef: orNull(v.contractRef),
        ...(v.status ? { status: v.status } : {}),
      },
    });
    revalidateAll();
    revalidatePath(`/projects/${id}`);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setLocale(locale: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (!isLocale(locale)) return { ok: false, error: "Unknown language" };
    await prisma.user.update({
      where: { email: String(session.user?.email).toLowerCase() },
      data: { locale },
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function addCost(projectId: string, input: unknown, requestId?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const parsed = costSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await recorded(async (tx) => {
      const cost = await tx.costEntry.create({
        data: {
          projectId,
          date: toDate(v.date),
          category: v.category,
          description: v.description,
          amount: v.amount,
          vendor: orNull(v.vendor),
          reference: orNull(v.reference),
          subcontractorId: v.category === "SUBCON" ? orNull(v.subcontractorId) : null,
          boqLineId: orNull(v.boqLineId),
          clientRequestId: rid,
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "COST",
        actor: actorFromSession(session),
        title: `Cost added: ${rm(v.amount)}`,
        description: v.description,
        metadata: { action: "added", costId: cost.id, amount: cost.amount.toFixed(2), category: v.category, reference: orNull(v.reference) },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function addPayment(projectId: string, input: unknown, requestId?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await recorded(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          projectId,
          date: toDate(v.date),
          amount: v.amount,
          reference: orNull(v.reference),
          claimId: orNull(v.claimId),
          clientRequestId: rid,
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "PAYMENT",
        actor: actorFromSession(session),
        title: `Payment received: ${rm(v.amount)}`,
        description: orNull(v.reference),
        metadata: { action: "added", paymentId: payment.id, amount: payment.amount.toFixed(2), claimId: orNull(v.claimId) },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function addChangeOrder(projectId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = changeOrderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await recorded(async (tx) => {
      const order = await tx.changeOrder.create({
        data: {
          projectId,
          date: toDate(v.date),
          description: v.description,
          amount: v.amount,
          status: "PENDING",
          boqLineId: orNull(v.boqLineId),
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "CHANGE_ORDER",
        actor: actorFromSession(session),
        title: `Change order raised: ${rm(v.amount)}`,
        description: v.description,
        metadata: { action: "added", changeOrderId: order.id, amount: order.amount.toFixed(2) },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function setChangeOrderStatus(
  changeOrderId: string,
  status: unknown,
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = changeOrderStatusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status" };
    await recorded(async (tx) => {
      const updated = await tx.changeOrder.update({
        where: { id: changeOrderId },
        data: {
          status: parsed.data,
          approvedAt: parsed.data === "APPROVED" ? new Date() : null,
        },
      });
      await appendEvent(tx, {
        projectId: updated.projectId,
        type: "CHANGE_ORDER",
        actor: actorFromSession(session),
        title: `Change order ${parsed.data.toLowerCase()}: ${rm(updated.amount)}`,
        description: updated.description,
        metadata: { action: "status", changeOrderId, status: parsed.data },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Edit or remove a money row. The change and its timeline event commit together; a removed or edited row is
 * never erased from the timeline, it is followed by a new event that says what changed.
 */
async function mutateRow<T extends { projectId: string }>(
  run: (tx: Prisma.TransactionClient) => Promise<T>,
  record: { type: "COST" | "PAYMENT" | "CHANGE_ORDER"; action: "updated" | "deleted"; title: (row: T) => string; description?: (row: T) => string | null },
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recorded(async (tx) => {
      const row = await run(tx);
      await appendEvent(tx, {
        projectId: row.projectId,
        type: record.type,
        actor: actorFromSession(session),
        title: record.title(row),
        description: record.description?.(row) ?? null,
        metadata: { action: record.action, rowId: (row as unknown as { id?: string }).id ?? null },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function updateCost(id: string, input: unknown): Promise<ActionResult> {
  const parsed = costSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  return mutateRow((tx) =>
    tx.costEntry.update({
      where: { id },
      data: {
        date: toDate(v.date),
        category: v.category,
        description: v.description,
        amount: v.amount,
        vendor: orNull(v.vendor),
        reference: orNull(v.reference),
        subcontractorId: v.category === "SUBCON" ? orNull(v.subcontractorId) : null,
        boqLineId: orNull(v.boqLineId),
        ...(v.category === "SUBCON" ? {} : { paidAt: null }),
      },
    }),
    { type: "COST", action: "updated", title: (r) => `Cost corrected: ${rm(r.amount)}`, description: (r) => r.description },
  );
}

export async function updatePayment(id: string, input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  return mutateRow(
    (tx) =>
      tx.payment.update({
        where: { id },
        data: { date: toDate(v.date), amount: v.amount, reference: orNull(v.reference), claimId: orNull(v.claimId) },
      }),
    { type: "PAYMENT", action: "updated", title: (r) => `Payment corrected: ${rm(r.amount)}`, description: (r) => r.reference },
  );
}

export async function updateChangeOrder(id: string, input: unknown): Promise<ActionResult> {
  const parsed = changeOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  return mutateRow(
    (tx) =>
      tx.changeOrder.update({
        where: { id },
        data: { date: toDate(v.date), description: v.description, amount: v.amount, boqLineId: orNull(v.boqLineId) },
      }),
    { type: "CHANGE_ORDER", action: "updated", title: (r) => `Change order corrected: ${rm(r.amount)}`, description: (r) => r.description },
  );
}

export async function deleteCost(id: string): Promise<ActionResult> {
  return mutateRow((tx) => tx.costEntry.delete({ where: { id } }), {
    type: "COST",
    action: "deleted",
    title: (r) => `Cost removed: ${rm(r.amount)}`,
    description: (r) => r.description,
  });
}

export async function deletePayment(id: string): Promise<ActionResult> {
  return mutateRow((tx) => tx.payment.delete({ where: { id } }), {
    type: "PAYMENT",
    action: "deleted",
    title: (r) => `Payment removed: ${rm(r.amount)}`,
    description: (r) => r.reference,
  });
}

export async function deleteChangeOrder(id: string): Promise<ActionResult> {
  return mutateRow((tx) => tx.changeOrder.delete({ where: { id } }), {
    type: "CHANGE_ORDER",
    action: "deleted",
    title: (r) => `Change order removed: ${rm(r.amount)}`,
    description: (r) => r.description,
  });
}

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

function quoteLineData(lines: { description: string; qty: string; unit: string; unitPrice: string }[]) {
  const { lineAmounts } = calculateQuote(lines, false);
  return lines.map((l, i) => ({
    position: i,
    description: l.description,
    qty: l.qty,
    unit: l.unit,
    unitPrice: l.unitPrice,
    amount: lineAmounts[i].toFixed(2),
  }));
}

export async function createQuote(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const parsed = quoteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const quote = await prisma.$transaction(async (tx) => {
      const last = await tx.quote.aggregate({ _max: { number: true } });
      return tx.quote.create({
        data: {
          number: (last._max.number ?? 0) + 1,
          clientName: v.clientName,
          title: v.title,
          date: toDate(v.date),
          sstEnabled: v.sstEnabled,
          status: v.status,
          notes: orNull(v.notes),
          lines: { create: quoteLineData(v.lines) },
        },
      });
    });
    revalidateAll();
    return { ok: true, data: { id: quote.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateQuote(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const parsed = quoteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Quote not found" };
    if (existing.projectId) return { ok: false, error: "This quote is already a project and can no longer be edited." };
    await prisma.$transaction([
      prisma.quoteLine.deleteMany({ where: { quoteId: id } }),
      prisma.quote.update({
        where: { id },
        data: {
          clientName: v.clientName,
          title: v.title,
          date: toDate(v.date),
          sstEnabled: v.sstEnabled,
          status: v.status,
          notes: orNull(v.notes),
          lines: { create: quoteLineData(v.lines) },
        },
      }),
    ]);
    revalidateAll();
    return { ok: true, data: { id } };
  } catch (error) {
    return failure(error);
  }
}

export async function setQuoteStatus(id: string, status: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = quoteStatusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status" };
    const existing = await prisma.quote.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Quote not found" };
    if (existing.projectId) return { ok: false, error: "This quote is already a project." };
    await prisma.quote.update({ where: { id }, data: { status: parsed.data } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** An accepted quote becomes a project: same line items (as the BOQ) and the quote subtotal as contract value. */
export async function convertQuoteToProject(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const project = await prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findUnique({ where: { id }, include: { lines: { orderBy: { position: "asc" } } } });
      if (!quote) throw new Error("Quote not found");
      if (quote.projectId) throw new Error("This quote has already been converted.");
      if (quote.status !== "ACCEPTED") throw new Error("Only an accepted quote can be converted.");
      const totals = calculateQuote(quote.lines, false);
      if (totals.subtotal <= 0) throw new Error("The quote total must be more than 0.");
      const created = await tx.project.create({
        data: {
          name: quote.title,
          clientName: quote.clientName,
          contractValue: totals.subtotal.toFixed(2),
          sstEnabled: quote.sstEnabled,
          sstRate: quote.sstRate,
          boqLines: {
            create: quote.lines.map((l) => ({
              position: l.position,
              description: l.description,
              qty: l.qty,
              unit: l.unit,
              rate: l.unitPrice,
              amount: l.amount,
            })),
          },
        },
      });
      await tx.quote.update({ where: { id }, data: { projectId: created.id } });
      return created;
    });
    revalidateAll();
    return { ok: true, data: { id: project.id } };
  } catch (error) {
    if (error instanceof Error && /quote|accepted|converted/i.test(error.message)) {
      return { ok: false, error: error.message };
    }
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// BOQ
// ---------------------------------------------------------------------------

function boqData(v: { description: string; qty: string; unit: string; rate: string }) {
  const amount = new Prisma.Decimal(v.qty).times(v.rate).toDP(2);
  return { description: v.description, qty: v.qty, unit: v.unit, rate: v.rate, amount: amount.toFixed(2) };
}

export async function addBoqLine(projectId: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = boqLineSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const last = await prisma.boqLine.aggregate({ where: { projectId }, _max: { position: true } });
    await prisma.boqLine.create({
      data: { projectId, position: (last._max.position ?? -1) + 1, ...boqData(parsed.data) },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function updateBoqLine(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = boqLineSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    await prisma.boqLine.update({ where: { id }, data: boqData(parsed.data) });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteBoqLine(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    await prisma.boqLine.delete({ where: { id } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Claims and retention
// ---------------------------------------------------------------------------

export async function issueClaim(projectId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    const parsed = claimSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const claim = await recorded(async (tx) => {
      const project = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: { claims: true, changeOrders: true },
      });
      const sum = (values: Prisma.Decimal.Value[]) =>
        values.reduce<Prisma.Decimal>((t, x) => t.plus(x), new Prisma.Decimal(0));
      const previousWork = sum(project.claims.map((c) => c.workDone));
      const approved = sum(project.changeOrders.filter((c) => c.status === "APPROVED").map((c) => c.amount));
      const ceiling = project.contractValue.plus(approved);
      if (previousWork.plus(v.workDone).greaterThan(ceiling)) {
        const left = ceiling.minus(previousWork);
        throw new Error(`That is more than the contract. At most RM ${left.toFixed(2)} is left to claim.`);
      }
      const figures = computeClaim({
        workDone: v.workDone,
        retentionPercent: project.retentionPercent,
        sstEnabled: project.sstEnabled,
        sstRate: project.sstRate,
        previousClaimed: sum(project.claims.map((c) => c.amountClaimed)),
      });
      const bumped = await tx.project.update({
        where: { id: projectId },
        data: { lastClaimNumber: { increment: 1 } },
      });
      const created = await tx.claim.create({
        data: {
          projectId,
          number: bumped.lastClaimNumber,
          date: toDate(v.date),
          workDone: figures.workDone.toFixed(2),
          sstAmount: figures.sstAmount.toFixed(2),
          amountClaimed: figures.amountClaimed.toFixed(2),
          retentionPercent: figures.retentionPercent.toFixed(2),
          retentionAmount: figures.retentionAmount.toFixed(2),
          previousClaimed: figures.previousClaimed.toFixed(2),
          netClaim: figures.netClaim.toFixed(2),
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "CLAIM",
        actor: actorFromSession(session),
        title: `Progress claim ${created.number} issued: ${rm(created.amountClaimed)}`,
        description: `Work done to date ${rm(created.workDone)}`,
        metadata: { action: "issued", claimId: created.id, number: created.number, workDone: created.workDone.toFixed(2), amountClaimed: created.amountClaimed.toFixed(2) },
      });
      return created;
    });
    revalidateAll();
    return { ok: true, data: { id: claim.id } };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("That is more than")) {
      return { ok: false, error: error.message };
    }
    return failure(error);
  }
}

/** Only the latest claim, and only while nothing has been paid against it, can be taken back. */
export async function deleteClaim(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recorded(async (tx) => {
      const claim = await tx.claim.findUniqueOrThrow({ where: { id }, include: { payments: true } });
      const project = await tx.project.findUniqueOrThrow({ where: { id: claim.projectId } });
      if (claim.number !== project.lastClaimNumber) throw new Error("claim: only the latest claim can be deleted.");
      if (claim.payments.length > 0) throw new Error("claim: this claim has payments recorded against it.");
      await tx.claim.delete({ where: { id } });
      await tx.project.update({ where: { id: project.id }, data: { lastClaimNumber: { decrement: 1 } } });
      await appendEvent(tx, {
        projectId: project.id,
        type: "CLAIM",
        actor: actorFromSession(session),
        title: `Progress claim ${claim.number} withdrawn: ${rm(claim.amountClaimed)}`,
        metadata: { action: "deleted", claimId: id, number: claim.number },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("claim: ")) {
      return { ok: false, error: error.message.slice(7) };
    }
    return failure(error);
  }
}

/** Records the retention money arriving: a payment on the project plus a running released total. */
export async function releaseRetention(projectId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = releaseRetentionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await recorded(async (tx) => {
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { claims: true } });
      const held = project.claims.reduce((t, c) => t.plus(c.retentionAmount), new Prisma.Decimal(0));
      const outstanding = held.minus(project.retentionReleased);
      if (new Prisma.Decimal(v.amount).greaterThan(outstanding)) {
        throw new Error(`release: only RM ${outstanding.toFixed(2)} of retention is outstanding.`);
      }
      const released = await tx.payment.create({
        data: { projectId, date: toDate(v.date), amount: v.amount, reference: "Retention release" },
      });
      await appendEvent(tx, {
        projectId,
        type: "PAYMENT",
        actor: actorFromSession(session),
        title: `Retention released: ${rm(v.amount)}`,
        metadata: { action: "added", paymentId: released.id, amount: released.amount.toFixed(2), retention: true },
      });
      await tx.project.update({ where: { id: projectId }, data: { retentionReleased: { increment: v.amount } } });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("release: ")) {
      return { ok: false, error: error.message.slice(9) };
    }
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Subcontractors
// ---------------------------------------------------------------------------

export async function createSubcontractor(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const parsed = subcontractorSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const sub = await prisma.subcontractor.create({
      data: { name: v.name, contact: orNull(v.contact), trade: orNull(v.trade), bank: orNull(v.bank) },
    });
    revalidateAll();
    return { ok: true, data: { id: sub.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function updateSubcontractor(id: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = subcontractorSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.subcontractor.update({
      where: { id },
      data: { name: v.name, contact: orNull(v.contact), trade: orNull(v.trade), bank: orNull(v.bank) },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Pass a date to mark a subcon cost as paid on that day, or null to undo it. */
export async function setCostPaid(costId: string, paidDate: string | null): Promise<ActionResult> {
  try {
    await requireSession();
    if (paidDate !== null && !paidDateSchema.safeParse(paidDate).success) return { ok: false, error: "Pick a date" };
    const cost = await prisma.costEntry.findUniqueOrThrow({ where: { id: costId } });
    if (cost.category !== "SUBCON") return { ok: false, error: "Only subcon costs can be marked as paid." };
    await prisma.costEntry.update({ where: { id: costId }, data: { paidAt: paidDate ? toDate(paidDate) : null } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function listClients(): Promise<ActionResult<{ id: string; name: string }[]>> {
  try {
    await requireSession();
    const clients = await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    return { ok: true, data: clients };
  } catch (error) {
    return failure(error);
  }
}

export async function createClient(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    await requireSession();
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const client = await prisma.client.create({
      data: {
        name: v.name,
        contactPerson: orNull(v.contactPerson),
        phone: orNull(v.phone),
        email: orNull(v.email),
        address: orNull(v.address),
        notes: orNull(v.notes),
      },
    });
    revalidateAll();
    return { ok: true, data: { id: client.id, name: client.name } };
  } catch (error) {
    return failure(error);
  }
}

/** One-time upgrade for a project that only has a typed client name: attach an existing client of that name, or create one. */
export async function linkProjectToClient(projectId: string): Promise<ActionResult> {
  try {
    await requireSession();
    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const name = project.clientName?.trim();
    if (project.clientId || !name) return { ok: false, error: "This project has no client name to link." };
    const all = await prisma.client.findMany();
    const client =
      all.find((c) => c.name.trim().toLowerCase() === name.toLowerCase()) ??
      (await prisma.client.create({ data: { name } }));
    await prisma.project.update({ where: { id: projectId }, data: { clientId: client.id, clientName: client.name } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Tasks and photos
// ---------------------------------------------------------------------------

export async function createTask(projectId: string, input: unknown, requestId?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    if (v.startDate && v.startDate > v.dueDate) return { ok: false, error: "The start date cannot be after the due date." };
    await recorded(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId,
          description: v.description,
          isMilestone: v.isMilestone,
          // A milestone is a single date with no assignee and no start.
          subcontractorId: v.isMilestone ? null : orNull(v.subcontractorId),
          startDate: v.isMilestone || !v.startDate ? null : toDate(v.startDate),
          dueDate: toDate(v.dueDate),
          clientRequestId: rid,
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "TASK_CREATED",
        actor: actorFromSession(session),
        title: v.isMilestone ? "Milestone set" : "Task assigned",
        description: v.description,
        metadata: { action: "added", taskId: task.id, dueDate: v.dueDate, milestone: v.isMilestone },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function setTaskStatus(id: string, status: unknown): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (status !== "OPEN" && status !== "DONE") return { ok: false, error: "Unknown status" };
    await recorded(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: { status, completedAt: status === "DONE" ? new Date() : null },
      });
      await appendEvent(tx, {
        projectId: task.projectId,
        type: status === "DONE" ? "TASK_COMPLETED" : "TASK_CREATED",
        actor: actorFromSession(session),
        title: status === "DONE" ? "Task completed" : "Task reopened",
        description: task.description,
        metadata: { action: status === "DONE" ? "completed" : "reopened", taskId: id },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const task = await prisma.task.findUnique({ where: { id } });
    await recorded(async (tx) => {
      await tx.task.delete({ where: { id } });
      if (task) {
        await appendEvent(tx, {
          projectId: task.projectId,
          type: "TASK_CREATED",
          actor: actorFromSession(session),
          title: "Task removed",
          description: task.description,
          metadata: { action: "deleted", taskId: id },
        });
      }
    });
    if (task?.photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: task.photoId } });
      if (photo) {
        await prisma.photo.delete({ where: { id: photo.id } }).catch(() => undefined);
        await deletePhotoFile(photo).catch(() => undefined);
      }
    }
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The subcontractor marks one of THEIR tasks done, optionally attaching the photo they just uploaded. */
export async function completeTask(taskId: string, photoId?: string): Promise<ActionResult> {
  try {
    const { session, user, subcontractorId } = await requireSub();
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.subcontractorId !== subcontractorId) return { ok: false, error: "That task is not assigned to you." };
    // A retried submission (or a double tap) on a task that is already done is a success, not an error.
    if (task.status === "DONE") return { ok: true };

    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { task: true } });
      // Only a photo this user just uploaded for this very project, and not already used, may be attached.
      if (!photo || photo.kind !== "TASK" || photo.uploadedById !== user.id || photo.projectId !== task.projectId || photo.task) {
        return { ok: false, error: "That photo cannot be attached." };
      }
    }
    await recorded(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: "DONE", completedAt: new Date(), photoId: photoId || null },
      });
      await appendEvent(tx, {
        projectId: task.projectId,
        type: "TASK_COMPLETED",
        actor: actorFromSession(session),
        title: "Task completed",
        description: task.description,
        metadata: { action: "completed", taskId, photoId: photoId || null },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) return { ok: true };
    await recorded(async (tx) => {
      await tx.photo.delete({ where: { id } });
      await appendEvent(tx, {
        projectId: photo.projectId,
        type: "PHOTO",
        actor: actorFromSession(session),
        title: "Photo removed",
        description: photo.caption,
        metadata: { action: "deleted", photoId: id, sha256: photo.sha256 },
      });
    });
    await deletePhotoFile(photo).catch(() => undefined);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Portal logins
// ---------------------------------------------------------------------------

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export async function createClientUser(clientId: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = loginUserSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.clientUser.create({
      data: { clientId, email: v.email, name: orNull(v.name), passwordHash: await bcrypt.hash(v.password, 10) },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "That email already has portal access." };
    return failure(error);
  }
}

export async function deleteClientUser(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    await prisma.clientUser.delete({ where: { id } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function createSubcontractorUser(subcontractorId: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = loginUserSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.user.create({
      data: { subcontractorId, email: v.email, name: orNull(v.name), passwordHash: await bcrypt.hash(v.password, 10) },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "That email is already in use." };
    return failure(error);
  }
}

export async function deleteSubcontractorUser(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const user = await prisma.user.findUnique({ where: { id } });
    // Only task-log logins can be removed here, never a staff account.
    if (!user?.subcontractorId) return { ok: false, error: "That is not a subcontractor login." };
    await prisma.user.delete({ where: { id } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Punch list
// ---------------------------------------------------------------------------

/** Contractor raises a defect, optionally with the photo of it (uploaded first as a PUNCH photo of this project). */
export async function createPunchItem(projectId: string, input: unknown, requestId?: string, photoId?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const parsed = punchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { punchIssue: true, punchFix: true } });
      if (!photo || photo.kind !== "PUNCH" || photo.projectId !== projectId || photo.punchIssue || photo.punchFix) {
        return { ok: false, error: "That photo cannot be attached." };
      }
    }
    await recorded(async (tx) => {
      const item = await tx.punchItem.create({
        data: {
          projectId,
          location: v.location,
          description: v.description,
          trade: v.trade,
          subcontractorId: orNull(v.subcontractorId),
          dueDate: v.dueDate ? toDate(v.dueDate) : null,
          photoId: photoId || null,
          clientRequestId: rid,
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "PUNCH_CREATED",
        actor: actorFromSession(session),
        title: `Defect raised at ${v.location}`,
        description: v.description,
        metadata: { action: "added", punchId: item.id, trade: v.trade, photoId: photoId || null },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function assignPunchItem(id: string, subcontractorId: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recorded(async (tx) => {
      const item = await tx.punchItem.update({ where: { id }, data: { subcontractorId: orNull(subcontractorId) } });
      await appendEvent(tx, {
        projectId: item.projectId,
        type: "PUNCH_CREATED",
        actor: actorFromSession(session),
        title: "Defect assigned",
        description: `${item.location}: ${item.description}`,
        metadata: { action: "assigned", punchId: id, subcontractorId: orNull(subcontractorId) },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The subcontractor says it is fixed, with a photo of the fix. A repeat (retry, double tap) is a success. */
export async function resolvePunchItem(id: string, photoId?: string): Promise<ActionResult> {
  try {
    const { session, user, subcontractorId } = await requireSub();
    const item = await prisma.punchItem.findUnique({ where: { id } });
    if (!item || item.subcontractorId !== subcontractorId) return { ok: false, error: "That item is not assigned to you." };
    if (item.status !== "OPEN") return { ok: true };
    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { punchIssue: true, punchFix: true } });
      if (!photo || photo.kind !== "PUNCH" || photo.uploadedById !== user.id || photo.projectId !== item.projectId || photo.punchIssue || photo.punchFix) {
        return { ok: false, error: "That photo cannot be attached." };
      }
    }
    await recorded(async (tx) => {
      await tx.punchItem.update({ where: { id }, data: { status: "DONE", resolvedAt: new Date(), resolvedPhotoId: photoId || null } });
      await appendEvent(tx, {
        projectId: item.projectId,
        type: "PUNCH_RESOLVED",
        actor: actorFromSession(session),
        title: `Defect fixed at ${item.location}`,
        description: item.description,
        metadata: { action: "resolved", punchId: id, photoId: photoId || null },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The contractor has looked at the fix and is satisfied. */
export async function closePunchItem(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recorded(async (tx) => {
      const item = await tx.punchItem.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
      await appendEvent(tx, {
        projectId: item.projectId,
        type: "PUNCH_RESOLVED",
        actor: actorFromSession(session),
        title: `Defect verified and closed at ${item.location}`,
        description: item.description,
        metadata: { action: "closed", punchId: id },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The fix was not good enough: back to the subcontractor. */
export async function reopenPunchItem(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recorded(async (tx) => {
      const item = await tx.punchItem.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, closedAt: null, resolvedPhotoId: null } });
      await appendEvent(tx, {
        projectId: item.projectId,
        type: "PUNCH_CREATED",
        actor: actorFromSession(session),
        title: `Fix rejected at ${item.location}; sent back`,
        description: item.description,
        metadata: { action: "reopened", punchId: id },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePunchItem(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const item = await prisma.punchItem.findUnique({ where: { id } });
    await recorded(async (tx) => {
      await tx.punchItem.delete({ where: { id } });
      if (item) {
        await appendEvent(tx, {
          projectId: item.projectId,
          type: "PUNCH_CREATED",
          actor: actorFromSession(session),
          title: `Defect removed at ${item.location}`,
          description: item.description,
          metadata: { action: "deleted", punchId: id },
        });
      }
    });
    for (const photoId of [item?.photoId, item?.resolvedPhotoId]) {
      if (!photoId) continue;
      const photo = await prisma.photo.findUnique({ where: { id: photoId } });
      if (photo) {
        await prisma.photo.delete({ where: { id: photo.id } }).catch(() => undefined);
        await deletePhotoFile(photo).catch(() => undefined);
      }
    }
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Remove one uploaded version (a wrong file). If it was the current one, the newest remaining version becomes current. */
export async function deleteDocumentVersion(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return { ok: true };
    await prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id } });
      if (doc.isCurrent) {
        const newest = await tx.document.findFirst({ where: { projectId: doc.projectId, nameKey: doc.nameKey }, orderBy: { version: "desc" } });
        if (newest) await tx.document.update({ where: { id: newest.id }, data: { isCurrent: true } });
      }
    });
    await deleteDocumentFile(doc).catch(() => undefined);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Client portal: what staff prepare for the client
// ---------------------------------------------------------------------------

/** Put a pending change order in front of the client for their decision. Clients never see drafts. */
export async function sendChangeOrderToClient(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const order = await prisma.changeOrder.findUnique({ where: { id }, include: { project: true } });
    if (!order) return { ok: false, error: "Change order not found." };
    if (!order.project.clientId) return { ok: false, error: "Link this project to a client first." };
    if (order.status !== "PENDING") return { ok: false, error: "Only a pending change order can be sent for approval." };
    await recorded(async (tx) => {
      await tx.changeOrder.update({ where: { id }, data: { sentToClientAt: order.sentToClientAt ?? new Date() } });
      if (!order.sentToClientAt) {
        await appendEvent(tx, {
          projectId: order.projectId,
          type: "CHANGE_ORDER",
          actor: actorFromSession(session),
          title: `Change order sent to client: ${rm(order.amount)}`,
          description: order.description,
          metadata: { action: "sent", changeOrderId: id },
        });
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** A note typed or dictated in the field. It goes straight onto the timeline, stamped with when it was written. */
export async function addNote(projectId: string, text: unknown, requestId?: string, capturedAtIso?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const note = typeof text === "string" ? text.trim() : "";
    if (!note) return { ok: false, error: "Write or say something first." };
    if (note.length > 2000) return { ok: false, error: "That note is too long (2,000 characters at most)." };
    const when = capturedAtIso ? new Date(capturedAtIso) : undefined;
    await recorded(async (tx) => {
      if (rid && (await tx.timelineEvent.findUnique({ where: { clientRequestId: rid } }))) return;
      await appendEvent(tx, {
        projectId,
        type: "NOTE",
        actor: actorFromSession(session),
        title: "Note",
        description: note,
        metadata: { action: "note" },
        capturedAt: when && !Number.isNaN(when.getTime()) ? when : undefined,
        clientRequestId: rid,
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function setProjectStage(projectId: string, stage: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    if (stage !== "" && !(PROJECT_STAGES as readonly string[]).includes(stage)) return { ok: false, error: "Unknown stage." };
    await recorded(async (tx) => {
      const before = await tx.project.findUniqueOrThrow({ where: { id: projectId }, select: { stage: true } });
      await tx.project.update({ where: { id: projectId }, data: { stage: stage || null } });
      if ((before.stage ?? "") !== stage) {
        await appendEvent(tx, {
          projectId,
          type: "STAGE_CHANGED",
          actor: actorFromSession(session),
          title: stage ? `Stage: ${stage}` : "Stage cleared",
          metadata: { action: "stage", from: before.stage, to: stage || null },
        });
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function createSelection(projectId: string, input: unknown, requestId?: string, photoId?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const parsed = selectionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { selection: true } });
      if (!photo || photo.kind !== "SELECTION" || photo.projectId !== projectId || photo.selection) return { ok: false, error: "That photo cannot be attached." };
    }
    await recorded(async (tx) => {
      const sel = await tx.selection.create({
        data: { projectId, category: v.category, name: v.name, details: orNull(v.details), photoId: photoId || null, clientRequestId: rid },
      });
      await appendEvent(tx, {
        projectId,
        type: "NOTE",
        actor: actorFromSession(session),
        title: "Product selection put to client",
        description: v.name,
        metadata: { action: "selection-added", selectionId: sel.id, photoId: photoId || null },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function deleteSelection(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const item = await prisma.selection.findUnique({ where: { id } });
    await recorded(async (tx) => {
      await tx.selection.delete({ where: { id } });
      if (item) {
        await appendEvent(tx, {
          projectId: item.projectId,
          type: "NOTE",
          actor: actorFromSession(session),
          title: "Product selection withdrawn",
          description: item.name,
          metadata: { action: "selection-deleted", selectionId: id },
        });
      }
    });
    if (item?.photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: item.photoId } });
      if (photo) {
        await prisma.photo.delete({ where: { id: photo.id } }).catch(() => undefined);
        await deletePhotoFile(photo).catch(() => undefined);
      }
    }
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function createDailyLog(projectId: string, input: unknown, requestId?: string): Promise<ActionResult> {
  const rid = requestIdOf(requestId);
  try {
    const session = await requireSession();
    const parsed = dailyLogSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    await recorded(async (tx) => {
      const log = await tx.dailyLog.create({ data: { projectId, date: toDate(parsed.data.date), note: parsed.data.note, clientRequestId: rid } });
      await appendEvent(tx, {
        projectId,
        type: "NOTE",
        actor: actorFromSession(session),
        title: "Progress note for the client",
        description: parsed.data.note,
        metadata: { action: "daily-log", logId: log.id, day: parsed.data.date },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function deleteDailyLog(id: string): Promise<ActionResult> {
  try {
    const session = await requireSession();
    await recorded(async (tx) => {
      const log = await tx.dailyLog.delete({ where: { id } });
      await appendEvent(tx, {
        projectId: log.projectId,
        type: "NOTE",
        actor: actorFromSession(session),
        title: "Progress note withdrawn",
        description: log.note,
        metadata: { action: "daily-log-deleted", logId: id },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function createPaymentMilestone(projectId: string, input: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    const parsed = milestoneSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const last = await prisma.paymentMilestone.aggregate({ where: { projectId }, _max: { position: true } });
    await prisma.paymentMilestone.create({
      data: { projectId, label: v.label, percent: v.percent, dueDate: v.dueDate ? toDate(v.dueDate) : null, position: (last._max.position ?? -1) + 1 },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePaymentMilestone(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    await prisma.paymentMilestone.delete({ where: { id } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Client portal: decisions made by the client (server clock, recorded with who decided)
// ---------------------------------------------------------------------------

/**
 * The client approves or rejects a change order that staff sent them. The time is taken from the SERVER
 * and the decision is tied to the signed-in client user, so it cannot be back-dated or made for someone else.
 * Approving also makes the change order count toward the contract, exactly as if staff had approved it.
 */
export async function decideChangeOrder(id: string, decision: unknown): Promise<ActionResult> {
  try {
    const { session, clientUser, clientId } = await requireClient();
    if (decision !== "APPROVED" && decision !== "REJECTED") return { ok: false, error: "Unknown decision." };
    const order = await prisma.changeOrder.findUnique({ where: { id }, include: { project: true } });
    // Another client's change order (or one that was never sent) is simply not found.
    if (!order || order.project.clientId !== clientId || !order.sentToClientAt) return { ok: false, error: "Change order not found." };
    if (order.clientDecision) return order.clientDecision === decision ? { ok: true } : { ok: false, error: "This change order has already been decided." };
    if (order.status !== "PENDING") return { ok: false, error: "This change order has already been decided by the contractor." };
    const now = new Date();
    await recorded(async (tx) => {
      await tx.changeOrder.update({
        where: { id },
        data: {
          clientDecision: decision,
          clientDecidedAt: now,
          clientDecidedById: clientUser.id,
          status: decision,
          approvedAt: decision === "APPROVED" ? now : null,
        },
      });
      await appendEvent(tx, {
        projectId: order.projectId,
        type: "APPROVAL",
        actor: { ...actorFromSession(session), name: clientUser.name ?? clientUser.email },
        title: `Client ${decision === "APPROVED" ? "approved" : "rejected"} a change order: ${rm(order.amount)}`,
        description: order.description,
        metadata: { action: decision.toLowerCase(), changeOrderId: id, clientUserId: clientUser.id },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function approveSelection(id: string): Promise<ActionResult> {
  try {
    const { session, clientUser, clientId } = await requireClient();
    const item = await prisma.selection.findUnique({ where: { id }, include: { project: true } });
    if (!item || item.project.clientId !== clientId) return { ok: false, error: "Selection not found." };
    if (item.status === "APPROVED") return { ok: true };
    await recorded(async (tx) => {
      await tx.selection.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date(), approvedById: clientUser.id } });
      await appendEvent(tx, {
        projectId: item.projectId,
        type: "APPROVAL",
        actor: { ...actorFromSession(session), name: clientUser.name ?? clientUser.email },
        title: "Client approved a product selection",
        description: item.name,
        metadata: { action: "approved", selectionId: id, clientUserId: clientUser.id },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

// ---------------------------------------------------------------------------
// Site diary (Buku Harian Tapak Bina)
// ---------------------------------------------------------------------------

const DIARY_FILE = "application/pdf";

/**
 * The supervisor signs the day's diary. It is then fixed: nothing in it can be edited. A second person
 * (not the preparer) countersigns, which locks it. Each step is a timeline event with the PDF's fingerprint.
 */
export async function createSiteDiary(projectId: string, input: unknown, requestId?: string, signedAtIso?: string): Promise<ActionResult<{ id: string }>> {
  const rid = requestIdOf(requestId);
  let saved: { id: string; fileKey: string; mimeType: string } | null = null;
  try {
    const session = await requireSession();
    const parsed = diarySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const png = decodeSignature(v.signature);
    if (!png) return { ok: false, error: "Please sign in the box first." };
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
    if (v.date > today) return { ok: false, error: "A diary cannot be dated in the future." };
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return { ok: false, error: "Project not found." };
    const date = toDate(v.date);
    if (await prisma.siteDiary.findUnique({ where: { projectId_date: { projectId, date } } })) {
      return { ok: false, error: "There is already a diary for that day." };
    }

    const actor = actorFromSession(session);
    const materials = await prisma.costEntry.findMany({ where: { projectId, category: "MATERIAL", date }, orderBy: { createdAt: "asc" } });
    // A diary signed with no signal keeps the time it was signed on the phone (the server's arrival time is in the timeline event).
    const claimed = signedAtIso ? new Date(signedAtIso) : null;
    const now = new Date();
    const preparedAt = claimed && !Number.isNaN(claimed.getTime()) && claimed.getTime() <= now.getTime() && claimed.getTime() > now.getTime() - 30 * 86_400_000 ? claimed : now;
    const content = {
      projectId,
      date: v.date,
      weather: v.weather,
      manpower: v.manpower,
      machinery: v.machinery,
      materialsIn: materials.map((m) => ({ description: m.description, vendor: m.vendor })),
      worksDone: v.worksDone,
      issues: orNull(v.issues),
      visitorLog: orNull(v.visitorLog),
      preparedById: actor.id ?? "",
      preparedAtIso: preparedAt.toISOString(),
    };
    const contentHash = diaryContentHash(content);
    const sigHash = signatureHash(contentHash, content.preparedById, content.preparedAtIso, png);
    const preparedBy = actor.name ?? "Staff";
    const pdf = await buildDiaryPdf({ ...content, projectName: project.name, preparedBy, preparedSignature: png, preparedSignatureHash: sigHash, contentHash, verified: null });
    const pdfKey = newPdfKey(projectId);
    saved = { id: pdfIdFromKey(pdfKey), fileKey: pdfKey, mimeType: DIARY_FILE };
    await saveDocumentFile(saved, pdf);
    const pdfSha256 = createHash("sha256").update(pdf).digest("hex");

    const id = randomBytes(12).toString("hex");
    await recorded(async (tx) => {
      await tx.siteDiary.create({
        data: {
          id,
          projectId,
          date,
          weather: v.weather,
          manpower: JSON.stringify(v.manpower),
          machinery: JSON.stringify(v.machinery),
          materialsIn: JSON.stringify(content.materialsIn),
          worksDone: v.worksDone,
          issues: content.issues,
          visitorLog: content.visitorLog,
          preparedById: content.preparedById,
          preparedBy,
          preparedAt,
          preparedSignature: Buffer.from(png).toString("base64"),
          preparedSignatureHash: sigHash,
          contentHash,
          pdfKey,
          pdfSha256,
          clientRequestId: rid,
        },
      });
      await appendEvent(tx, {
        projectId,
        type: "SITE_DIARY",
        actor,
        title: `Site diary signed for ${v.date}`,
        description: `${v.weather}. ${v.worksDone}`.slice(0, 300),
        capturedAt: preparedAt,
        metadata: { action: "signed", diaryId: id, date: v.date, contentHash, signatureHash: sigHash, pdfSha256, awaiting: true },
      });
    });
    revalidateAll();
    return { ok: true, data: { id } };
  } catch (error) {
    if (saved) await deleteDocumentFile(saved).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      if (rid && (await prisma.siteDiary.findUnique({ where: { clientRequestId: rid } }))) return { ok: true };
      return { ok: false, error: "There is already a diary for that day." };
    }
    return failure(error);
  }
}

/** A different person from the preparer countersigns. This locks the diary for good. */
export async function countersignSiteDiary(id: string, signature: string): Promise<ActionResult> {
  let saved: { id: string; fileKey: string; mimeType: string } | null = null;
  try {
    const session = await requireSession();
    const actor = actorFromSession(session);
    const diary = await prisma.siteDiary.findUnique({ where: { id }, include: { project: true } });
    if (!diary) return { ok: false, error: "Diary not found." };
    if (diary.status === "LOCKED") return { ok: true };
    if (diary.preparedById === actor.id) return { ok: false, error: "A different person must countersign this diary." };
    const png = decodeSignature(signature);
    if (!png) return { ok: false, error: "Please sign in the box first." };

    const verifiedAt = new Date();
    const verifiedBy = actor.name ?? "Staff";
    const sigHash = signatureHash(diary.contentHash, actor.id ?? "", verifiedAt.toISOString(), png);
    const dateKey = diary.date.toISOString().slice(0, 10);
    const pdf = await buildDiaryPdf({
      projectId: diary.projectId,
      date: dateKey,
      weather: diary.weather,
      manpower: JSON.parse(diary.manpower),
      machinery: JSON.parse(diary.machinery),
      materialsIn: JSON.parse(diary.materialsIn),
      worksDone: diary.worksDone,
      issues: diary.issues,
      visitorLog: diary.visitorLog,
      preparedById: diary.preparedById,
      preparedAtIso: diary.preparedAt.toISOString(),
      projectName: diary.project.name,
      preparedBy: diary.preparedBy,
      preparedSignature: new Uint8Array(Buffer.from(diary.preparedSignature, "base64")),
      preparedSignatureHash: diary.preparedSignatureHash,
      contentHash: diary.contentHash,
      verified: { by: verifiedBy, atIso: verifiedAt.toISOString(), signature: png, hash: sigHash },
    });
    const pdfKey = newPdfKey(diary.projectId);
    saved = { id: pdfIdFromKey(pdfKey), fileKey: pdfKey, mimeType: DIARY_FILE };
    await saveDocumentFile(saved, pdf);
    const pdfSha256 = createHash("sha256").update(pdf).digest("hex");

    await recorded(async (tx) => {
      // Only the first countersignature counts; a second tap finds nothing left to update.
      const changed = await tx.siteDiary.updateMany({
        where: { id, status: "AWAITING_COUNTERSIGN" },
        data: {
          status: "LOCKED",
          verifiedById: actor.id,
          verifiedBy,
          verifiedAt,
          verifiedSignature: Buffer.from(png).toString("base64"),
          verifiedSignatureHash: sigHash,
          pdfKey,
          pdfSha256,
        },
      });
      if (changed.count === 0) return;
      await appendEvent(tx, {
        projectId: diary.projectId,
        type: "SITE_DIARY",
        actor,
        title: `Site diary for ${dateKey} countersigned and locked`,
        description: `Prepared by ${diary.preparedBy}, countersigned by ${verifiedBy}`,
        metadata: { action: "locked", diaryId: id, date: dateKey, contentHash: diary.contentHash, signatureHash: sigHash, pdfSha256 },
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (saved) await deleteDocumentFile(saved).catch(() => undefined);
    return failure(error);
  }
}
