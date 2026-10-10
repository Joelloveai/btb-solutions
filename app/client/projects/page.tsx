import Link from "next/link";
import { PortalHeader } from "@/components/portal/portal-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { completionPercent } from "@/lib/gantt";
import { clientOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const tone = { ACTIVE: "blue", COMPLETED: "green", ON_HOLD: "yellow", CANCELLED: "gray" } as const;

export default async function ClientProjectsPage() {
  const { clientId, clientUser } = await clientOrRedirect();
  const projects = await prisma.project.findMany({
    where: { clientId },
    include: { tasks: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PortalHeader title="Your projects" home="/client/projects" signOutTo="/client/login" />
      <p className="mb-4 text-sm text-muted-foreground">Signed in as {clientUser.email}</p>
      {projects.length === 0 ? (
        <EmptyState title="No projects yet" hint="Your contractor will link your project here." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => {
            const pct = completionPercent(p.tasks);
            return (
              <li key={p.id}>
                <Link href={`/client/projects/${p.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold leading-snug">{p.name}</h2>
                      <Badge tone={tone[p.status as ProjectStatus] ?? "gray"}>{PROJECT_STATUS_LABELS[p.status as ProjectStatus] ?? p.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{pct === null ? "No tasks scheduled yet" : `${pct}% complete`}</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
