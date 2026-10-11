"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { requireSession, requireSub } from "@/lib/auth";
import { deletePhotoFile } from "@/lib/photos";
import { computeClaim } from "@/lib/claims";
import { isLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { calculateQuote } from "@/lib/quotes";
import {
  boqLineSchema,
  changeOrderSchema,
  claimSchema,
  loginUserSchema,
  punchSchema,
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
    await requireSession();
    const parsed = costSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.costEntry.create({
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
    await requireSession();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.payment.create({
      data: {
        projectId,
        date: toDate(v.date),
        amount: v.amount,
        reference: orNull(v.reference),
        claimId: orNull(v.claimId),
        clientRequestId: rid,
      },
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
    await requireSession();
    const parsed = changeOrderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.changeOrder.create({
      data: {
        projectId,
        date: toDate(v.date),
        description: v.description,
        amount: v.amount,
        status: "PENDING",
        boqLineId: orNull(v.boqLineId),
      },
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
    await requireSession();
    const parsed = changeOrderStatusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status" };
    const updated = await prisma.changeOrder.update({
      where: { id: changeOrderId },
      data: {
        status: parsed.data,
        approvedAt: parsed.data === "APPROVED" ? new Date() : null,
      },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

async function mutateRow<T extends { projectId: string }>(run: () => Promise<T>): Promise<ActionResult> {
  try {
    await requireSession();
    const row = await run();
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
  return mutateRow(() =>
    prisma.costEntry.update({
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
  );
}

export async function updatePayment(id: string, input: unknown): Promise<ActionResult> {
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  return mutateRow(() =>
    prisma.payment.update({
      where: { id },
      data: { date: toDate(v.date), amount: v.amount, reference: orNull(v.reference), claimId: orNull(v.claimId) },
    }),
  );
}

export async function updateChangeOrder(id: string, input: unknown): Promise<ActionResult> {
  const parsed = changeOrderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  return mutateRow(() =>
    prisma.changeOrder.update({
      where: { id },
      data: { date: toDate(v.date), description: v.description, amount: v.amount, boqLineId: orNull(v.boqLineId) },
    }),
  );
}

export async function deleteCost(id: string): Promise<ActionResult> {
  return mutateRow(() => prisma.costEntry.delete({ where: { id } }));
}

export async function deletePayment(id: string): Promise<ActionResult> {
  return mutateRow(() => prisma.payment.delete({ where: { id } }));
}

export async function deleteChangeOrder(id: string): Promise<ActionResult> {
  return mutateRow(() => prisma.changeOrder.delete({ where: { id } }));
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
    await requireSession();
    const parsed = claimSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const claim = await prisma.$transaction(async (tx) => {
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
      return tx.claim.create({
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
    await requireSession();
    await prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUniqueOrThrow({ where: { id }, include: { payments: true } });
      const project = await tx.project.findUniqueOrThrow({ where: { id: claim.projectId } });
      if (claim.number !== project.lastClaimNumber) throw new Error("claim: only the latest claim can be deleted.");
      if (claim.payments.length > 0) throw new Error("claim: this claim has payments recorded against it.");
      await tx.claim.delete({ where: { id } });
      await tx.project.update({ where: { id: project.id }, data: { lastClaimNumber: { decrement: 1 } } });
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
    await requireSession();
    const parsed = releaseRetentionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUniqueOrThrow({ where: { id: projectId }, include: { claims: true } });
      const held = project.claims.reduce((t, c) => t.plus(c.retentionAmount), new Prisma.Decimal(0));
      const outstanding = held.minus(project.retentionReleased);
      if (new Prisma.Decimal(v.amount).greaterThan(outstanding)) {
        throw new Error(`release: only RM ${outstanding.toFixed(2)} of retention is outstanding.`);
      }
      await tx.payment.create({
        data: { projectId, date: toDate(v.date), amount: v.amount, reference: "Retention release" },
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
    await requireSession();
    const parsed = taskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    if (v.startDate && v.startDate > v.dueDate) return { ok: false, error: "The start date cannot be after the due date." };
    await prisma.task.create({
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
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function setTaskStatus(id: string, status: unknown): Promise<ActionResult> {
  try {
    await requireSession();
    if (status !== "OPEN" && status !== "DONE") return { ok: false, error: "Unknown status" };
    await prisma.task.update({
      where: { id },
      data: { status, completedAt: status === "DONE" ? new Date() : null },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const task = await prisma.task.findUnique({ where: { id } });
    await prisma.task.delete({ where: { id } });
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
    const { user, subcontractorId } = await requireSub();
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
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "DONE", completedAt: new Date(), photoId: photoId || null },
    });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePhoto(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const photo = await prisma.photo.findUnique({ where: { id } });
    if (!photo) return { ok: true };
    await prisma.photo.delete({ where: { id } });
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
    await requireSession();
    const parsed = punchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { punchIssue: true, punchFix: true } });
      if (!photo || photo.kind !== "PUNCH" || photo.projectId !== projectId || photo.punchIssue || photo.punchFix) {
        return { ok: false, error: "That photo cannot be attached." };
      }
    }
    await prisma.punchItem.create({
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
    revalidateAll();
    return { ok: true };
  } catch (error) {
    if (alreadyApplied(error, rid)) return { ok: true };
    return failure(error);
  }
}

export async function assignPunchItem(id: string, subcontractorId: string): Promise<ActionResult> {
  try {
    await requireSession();
    await prisma.punchItem.update({ where: { id }, data: { subcontractorId: orNull(subcontractorId) } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The subcontractor says it is fixed, with a photo of the fix. A repeat (retry, double tap) is a success. */
export async function resolvePunchItem(id: string, photoId?: string): Promise<ActionResult> {
  try {
    const { user, subcontractorId } = await requireSub();
    const item = await prisma.punchItem.findUnique({ where: { id } });
    if (!item || item.subcontractorId !== subcontractorId) return { ok: false, error: "That item is not assigned to you." };
    if (item.status !== "OPEN") return { ok: true };
    if (photoId) {
      const photo = await prisma.photo.findUnique({ where: { id: photoId }, include: { punchIssue: true, punchFix: true } });
      if (!photo || photo.kind !== "PUNCH" || photo.uploadedById !== user.id || photo.projectId !== item.projectId || photo.punchIssue || photo.punchFix) {
        return { ok: false, error: "That photo cannot be attached." };
      }
    }
    await prisma.punchItem.update({ where: { id }, data: { status: "DONE", resolvedAt: new Date(), resolvedPhotoId: photoId || null } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The contractor has looked at the fix and is satisfied. */
export async function closePunchItem(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    await prisma.punchItem.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The fix was not good enough: back to the subcontractor. */
export async function reopenPunchItem(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    await prisma.punchItem.update({ where: { id }, data: { status: "OPEN", resolvedAt: null, closedAt: null, resolvedPhotoId: null } });
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function deletePunchItem(id: string): Promise<ActionResult> {
  try {
    await requireSession();
    const item = await prisma.punchItem.findUnique({ where: { id } });
    await prisma.punchItem.delete({ where: { id } });
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
