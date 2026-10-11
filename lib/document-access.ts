import { prisma } from "./prisma";
import { tradeTagFor } from "./trade-tag";

/**
 * What a subcontractor may open: the CURRENT version of a DRAWING, on a project they have work on (a
 * task or a punch item), that is either for every trade or for their own. A superseded drawing is never
 * offered, because building from an out-of-date drawing is exactly the mistake this prevents.
 */
export async function documentWhereForSub(subcontractorId: string) {
  const sub = await prisma.subcontractor.findUnique({ where: { id: subcontractorId } });
  const [tasks, punch] = await Promise.all([
    prisma.task.findMany({ where: { subcontractorId }, select: { projectId: true }, distinct: ["projectId"] }),
    prisma.punchItem.findMany({ where: { subcontractorId }, select: { projectId: true }, distinct: ["projectId"] }),
  ]);
  const projectIds = [...new Set([...tasks, ...punch].map((p) => p.projectId))];
  return {
    projectId: { in: projectIds },
    isCurrent: true,
    type: "Drawing",
    OR: [{ trade: null }, { trade: "" }, { trade: tradeTagFor(sub?.trade) }],
  };
}
