import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProjectGantt } from "@/components/gantt/gantt-loader";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PortalHeader } from "@/components/portal/portal-header";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { completionPercent, toGanttTasks } from "@/lib/gantt";
import { clientOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const tone = { ACTIVE: "blue", COMPLETED: "green", ON_HOLD: "yellow", CANCELLED: "gray" } as const;

/**
 * Read-only view for the client. It deliberately selects only what a client may see:
 * no costs, claims, quotes or subcontractor names, and no subcontractor task photos.
 */
export default async function ClientProjectPage({ params }: { params: { id: string } }) {
  const { clientId } = await clientOrRedirect();
  const project = await prisma.project.findFirst({
    // Another client's project (or a made-up id) is simply not found.
    where: { id: params.id, clientId },
    select: {
      id: true,
      name: true,
      status: true,
      photos: { where: { kind: { in: ["PROGRESS", "FLOORPLAN"] } }, orderBy: { takenAt: "desc" } },
      tasks: { select: { id: true, description: true, startDate: true, dueDate: true, isMilestone: true, status: true }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!project) notFound();

  const pct = completionPercent(project.tasks);
  // What the client sees: when it was taken, which phase and trade, and where on site. Never GPS coordinates.
  const item = (p: (typeof project.photos)[number]) => {
    const taken = p.capturedAt ?? p.takenAt;
    return { id: p.id, caption: p.caption, takenAtText: formatDateTime(taken), takenAtMs: taken.getTime(), phase: p.phase, trade: p.trade, location: p.location };
  };
  const progress = project.photos.filter((p) => p.kind === "PROGRESS").map(item);
  const plans = project.photos.filter((p) => p.kind === "FLOORPLAN").map(item);

  return (
    <>
      <PortalHeader title="Your project" home="/client/projects" signOutTo="/client/login" />
      <Link href="/client/projects" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        All projects
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
          <Badge tone={tone[project.status as ProjectStatus] ?? "gray"}>{PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status}</Badge>
        </div>
        <div className="mt-3 max-w-md">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-mono font-semibold" data-testid="completion">
              {pct === null ? "No tasks scheduled yet" : `${pct}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Project completion">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>
      </header>

      <section className="mb-8" aria-label="Progress photos">
        <h2 className="mb-3 text-base font-semibold">Progress photos</h2>
        <PhotoGallery photos={progress} compare emptyText="No photos yet. Your contractor will add them as work progresses." />
      </section>

      <section className="mb-8" aria-label="Floor plans">
        <h2 className="mb-3 text-base font-semibold">Floor plan</h2>
        <PhotoGallery photos={plans} emptyText="No floor plan has been shared yet." />
      </section>

      <section className="mb-8" aria-label="Timeline">
        <h2 className="mb-3 text-base font-semibold">Timeline</h2>
        {project.tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">The schedule has not been set yet.</p>
        ) : (
          <ProjectGantt tasks={toGanttTasks(project.tasks)} />
        )}
      </section>
    </>
  );
}
