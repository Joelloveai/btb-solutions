"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  changeOrderSchema,
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

function failure(error: unknown): ActionResult<never> {
  if (error instanceof Error && error.message === "Not signed in") {
    return { ok: false, error: "Please sign in again." };
  }
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSession();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    const v = parsed.data;
    const project = await prisma.project.create({
      data: {
        name: v.name,
        clientName: orNull(v.clientName),
        contractValue: v.contractValue,
        startDate: v.startDate ? toDate(v.startDate) : null,
      },
    });
    revalidatePath("/dashboard");
    revalidatePath("/projects");
    return { ok: true, data: { id: project.id } };
  } catch (error) {
    return failure(error);
  }
}

export async function addCost(projectId: string, input: unknown): Promise<ActionResult> {
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
      },
    });
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function addPayment(projectId: string, input: unknown): Promise<ActionResult> {
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
      },
    });
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${projectId}`);
    return { ok: true };
  } catch (error) {
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
      },
    });
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${projectId}`);
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
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${updated.projectId}`);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
