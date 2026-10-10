import { ImageViewer } from "@/components/photos/image-viewer";
import { PortalHeader } from "@/components/portal/portal-header";
import { TaskDoneForm } from "@/components/tasks/task-done-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime, todayInMalaysia } from "@/lib/format";
import { subOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SubTasksPage() {
  const { subcontractorId, user } = await subOrRedirect();
  const sub = await prisma.subcontractor.findUnique({ where: { id: subcontractorId } });
  // Only this subcontractor's own tasks; the project name is all they learn about the job.
  const tasks = await prisma.task.findMany({
    where: { subcontractorId },
    include: { project: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });
  const today = todayInMalaysia();
  const open = tasks.filter((t) => t.status === "OPEN");
  const done = tasks.filter((t) => t.status === "DONE").sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  return (
    <>
      <PortalHeader title="My tasks" home="/sub/tasks" signOutTo="/login" />
      <p className="mb-4 text-sm text-muted-foreground">
        {sub?.name ?? user.email} · {open.length} open
      </p>

      <section aria-label="Open tasks" className="space-y-3">
        {open.length === 0 ? (
          <EmptyState title="Nothing to do right now" hint="New tasks from BTB Builders will appear here." />
        ) : (
          open.map((task) => {
            const overdue = task.dueDate < today;
            return (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-snug">{task.description}</p>
                    <p className="text-sm text-muted-foreground">{task.project.name}</p>
                  </div>
                  <Badge tone={overdue ? "red" : "yellow"}>{overdue ? "Overdue" : "Open"}</Badge>
                </div>
                <p className="mt-1 text-sm">Due {formatDate(task.dueDate)}</p>
                <TaskDoneForm taskId={task.id} taskLabel={task.description} />
              </Card>
            );
          })
        )}
      </section>

      {done.length > 0 ? (
        <section aria-label="Done tasks" className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Done</h2>
          {done.map((task) => (
            <Card key={task.id} className="flex items-center gap-3 p-3">
              {task.photoId ? (
                <div className="w-16 shrink-0">
                  <ImageViewer id={task.photoId} title={task.description}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${task.photoId}`} alt={`Photo for ${task.description}`} className="aspect-square w-full object-cover" />
                  </ImageViewer>
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.description}</p>
                <p className="text-xs text-muted-foreground">
                  {task.project.name} · done {task.completedAt ? formatDateTime(task.completedAt) : ""}
                </p>
              </div>
              <Badge tone="green">Done</Badge>
            </Card>
          ))}
        </section>
      ) : null}
    </>
  );
}
