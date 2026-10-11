import { Prisma } from "@prisma/client";
import { completionPercent } from "@/lib/gantt";
import { prisma } from "@/lib/prisma";
import { appendEvent, recorded } from "@/lib/timeline";
import { digestText, lastSundaySixPm, weekStartOf } from "@/lib/weekly-summary";

/**
 * The homeowner's Sunday 6pm summary. It is made the first time the feed is opened after that moment and then
 * kept, so it always reads as it did that evening. (There is no push; it is waiting in the app.)
 */
export async function ensureWeeklyDigest(projectId: string, now = new Date()) {
  const weekEnding = lastSundaySixPm(now);
  const existing = await prisma.clientDigest.findUnique({ where: { projectId_weekEnding: { projectId, weekEnding } } });
  if (existing) return existing;

  const from = weekStartOf(weekEnding);
  const nextEnd = new Date(weekEnding.getTime() + 7 * 86_400_000);
  const [tasks, photos] = await Promise.all([
    prisma.task.findMany({ where: { projectId }, select: { status: true, completedAt: true, dueDate: true } }),
    prisma.photo.count({ where: { projectId, kind: "PROGRESS", OR: [{ capturedAt: { gt: from, lte: weekEnding } }, { capturedAt: null, takenAt: { gt: from, lte: weekEnding } }] } }),
  ]);
  const body = digestText({
    photos,
    tasksDone: tasks.filter((t) => t.status === "DONE" && t.completedAt && t.completedAt > from && t.completedAt <= weekEnding).length,
    nextWeekDue: tasks.filter((t) => t.status === "OPEN" && t.dueDate > weekEnding && t.dueDate <= nextEnd).length,
    percent: completionPercent(tasks),
  });
  try {
    return await recorded(async (tx) => {
      const digest = await tx.clientDigest.create({ data: { projectId, weekEnding, body } });
      await appendEvent(tx, {
        projectId,
        type: "MESSAGE",
        actor: { id: null, role: "system", name: "BTB Solutions" },
        title: "Weekly summary ready for the client",
        description: body,
        metadata: { action: "digest", digestId: digest.id },
        capturedAt: weekEnding,
      });
      return digest;
    });
  } catch (error) {
    // Two devices opening the feed at the same moment: the second finds the first one's summary.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.clientDigest.findUnique({ where: { projectId_weekEnding: { projectId, weekEnding } } });
    }
    throw error;
  }
}
