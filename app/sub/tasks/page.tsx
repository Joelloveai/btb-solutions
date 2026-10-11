import Link from "next/link";
import { PendingOps } from "@/components/offline/pending-ops";
import { ImageViewer } from "@/components/photos/image-viewer";
import { PortalHeader } from "@/components/portal/portal-header";
import { SubNav } from "@/components/portal/sub-nav";
import { TaskDoneForm } from "@/components/tasks/task-done-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime, formatRM, todayInMalaysia } from "@/lib/format";
import { owedSummary } from "@/lib/sub-owed";
import { subOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { BUCKET_LABELS, BUCKET_ORDER, dailySummary, dueBucket } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * A subcontractor's home: everything assigned to them on EVERY project, ordered by when it is due,
 * with what is overdue first and in red, and a short summary of what is new since yesterday.
 */
export default async function SubTasksPage() {
  const { subcontractorId, user } = await subOrRedirect();
  const sub = await prisma.subcontractor.findUnique({ where: { id: subcontractorId } });
  const [tasks, punch, subCosts] = await Promise.all([
    prisma.task.findMany({ where: { subcontractorId }, include: { project: { select: { name: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.punchItem.findMany({ where: { subcontractorId, status: "OPEN" }, include: { project: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] }),
    prisma.costEntry.findMany({ where: { subcontractorId, category: "SUBCON" }, include: { project: { select: { name: true } } } }),
  ]);
  const owed = owedSummary(subCosts.map((c) => ({ projectId: c.projectId, projectName: c.project.name, amount: c.amount, paidAt: c.paidAt })));
  const today = todayInMalaysia();
  const open = tasks.filter((t) => t.status === "OPEN");
  const done = tasks.filter((t) => t.status === "DONE").sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  const summary = dailySummary(tasks, punch, new Date(), today);
  const projectCount = new Set([...tasks, ...punch].map((i) => i.projectId)).size;

  return (
    <>
      <PortalHeader title="My tasks" home="/sub/tasks" signOutTo="/login" />
      <SubNav />
      <section aria-label="What you are owed" className="mb-5 rounded-xl border bg-card p-4 shadow-sm" data-testid="owed">
        <p className="text-lg font-semibold" data-testid="owed-headline">
          You are owed {formatRM(owed.total.toNumber())} across {owed.projects.length} {owed.projects.length === 1 ? "project" : "projects"}.
        </p>
        {owed.projects.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {owed.projects.map((p) => (
              <li key={p.projectId} className="flex justify-between gap-3" data-testid="owed-project">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="font-mono tabular-nums">{formatRM(p.owed.toNumber())}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Nothing is waiting to be paid to you right now.</p>
        )}
      </section>

      <p className="mb-4 text-sm text-muted-foreground">
        {sub?.name ?? user.email} · {open.length} open task{open.length === 1 ? "" : "s"}
        {projectCount > 0 ? ` across ${projectCount} project${projectCount === 1 ? "" : "s"}` : ""}
      </p>

      <section aria-label="Daily summary" className="mb-5 grid grid-cols-2 gap-2">
        {[
          { label: "New tasks", value: summary.newTasks, hot: false },
          { label: "Due tomorrow", value: summary.dueTomorrow, hot: false },
          { label: "Overdue", value: summary.overdue, hot: summary.overdue > 0 },
          { label: "New punch items", value: summary.newPunch, hot: false },
        ].map((tile) => (
          <Card key={tile.label} className="p-3" data-testid={`summary-${tile.label.toLowerCase().replace(/ /g, "-")}`}>
            <p className={cn("font-mono text-2xl font-semibold tabular-nums", tile.hot && "text-loss")}>{tile.value}</p>
            <p className="text-xs text-muted-foreground">{tile.label}</p>
          </Card>
        ))}
      </section>

      <PendingOps />

      <section aria-label="Open tasks" className="space-y-5">
        {open.length === 0 ? (
          <EmptyState title="Nothing to do right now" hint="New tasks from BTB Builders will appear here." />
        ) : (
          BUCKET_ORDER.map((bucket) => {
            const group = open.filter((t) => dueBucket(t.dueDate, today) === bucket);
            if (group.length === 0) return null;
            return (
              <div key={bucket} className="space-y-3" data-testid={`group-${bucket}`}>
                <h2 className={cn("text-sm font-semibold", bucket === "overdue" ? "text-loss" : "text-muted-foreground")}>
                  {BUCKET_LABELS[bucket]} ({group.length})
                </h2>
                {group.map((task) => (
                  <Card key={task.id} className={cn("p-4", bucket === "overdue" && "border-loss/40")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-snug">{task.description}</p>
                        <p className="text-sm text-muted-foreground">{task.project.name}</p>
                      </div>
                      <Badge tone={bucket === "overdue" ? "red" : "yellow"}>{bucket === "overdue" ? "Overdue" : "Open"}</Badge>
                    </div>
                    <p className="mt-1 text-sm">Due {formatDate(task.dueDate)}</p>
                    <TaskDoneForm taskId={task.id} taskLabel={task.description} />
                  </Card>
                ))}
              </div>
            );
          })
        )}
      </section>

      {punch.length > 0 ? (
        <section aria-label="Punch items due" className="mt-8 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Punch items to fix ({punch.length})</h2>
            <Link href="/sub/punch" className="text-sm font-medium underline underline-offset-2">
              See all punch items
            </Link>
          </div>
          {punch.map((item) => {
            const overdue = !!item.dueDate && item.dueDate < today;
            return (
              <Card key={item.id} className={cn("flex items-center justify-between gap-3 p-3", overdue && "border-loss/40")}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.location}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.project.name} · {item.dueDate ? `due ${formatDate(item.dueDate)}` : "no due date"}
                  </p>
                </div>
                <Badge tone={overdue ? "red" : "yellow"}>{overdue ? "Overdue" : "Open"}</Badge>
              </Card>
            );
          })}
        </section>
      ) : null}

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
