import { Prisma } from "@prisma/client";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeOrderApprovals, SelectionApprovals } from "@/components/client-portal/approvals";
import { StageTracker } from "@/components/client-portal/stage-tracker";
import { ProjectGantt } from "@/components/gantt/gantt-loader";
import { PhotoGallery } from "@/components/photos/photo-gallery";
import { PortalHeader } from "@/components/portal/portal-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { calculateTotals } from "@/lib/calculations";
import { formatDate, formatDateTime, formatRM, todayInMalaysia } from "@/lib/format";
import { completionPercent, toGanttTasks } from "@/lib/gantt";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { clientOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const tone = { ACTIVE: "blue", COMPLETED: "green", ON_HOLD: "yellow", CANCELLED: "gray" } as const;
const scheduleTone = { PAID: "green", PART_PAID: "yellow", OUTSTANDING: "gray" } as const;
const scheduleLabel = { PAID: "Paid", PART_PAID: "Part paid", OUTSTANDING: "Outstanding" } as const;

/** Calendar day in Malaysia, so a photo taken at 11 pm lands on the day it was taken. */
const klDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(d);

/**
 * Read-only view for the client. It deliberately selects only what a client may see: progress, photos,
 * the schedule, the instalments they agreed to, and the decisions put to them. No costs, claims, quotes,
 * profit or subcontractor names, and no subcontractor task photos or GPS positions.
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
      stage: true,
      // Only what is needed to work out the price the client is billed.
      contractValue: true,
      sstEnabled: true,
      sstRate: true,
      payments: { select: { amount: true } },
      // Change orders reach the client only after staff send them for approval.
      changeOrders: {
        where: { OR: [{ sentToClientAt: { not: null } }] },
        orderBy: { date: "asc" },
        select: { id: true, description: true, date: true, amount: true, status: true, clientDecision: true, clientDecidedAt: true },
      },
      selections: { orderBy: { createdAt: "asc" } },
      dailyLogs: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { id: true, date: true, note: true } },
      paymentMilestones: { orderBy: { position: "asc" } },
      photos: { where: { kind: { in: ["PROGRESS", "FLOORPLAN"] } }, orderBy: { takenAt: "desc" } },
      tasks: { select: { id: true, description: true, startDate: true, dueDate: true, isMilestone: true, status: true }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!project) notFound();

  const money = (n: number) => formatRM(n, "en");
  const pct = completionPercent(project.tasks);

  // What the client is billed in all (contract + approved variations + SST), and which instalments the payments so far cover.
  const approved = await prisma.changeOrder.findMany({ where: { projectId: project.id, status: "APPROVED" }, select: { amount: true, status: true } });
  const { billableTotal } = calculateTotals({ contractValue: project.contractValue, costs: [], payments: project.payments, changeOrders: approved, sstEnabled: project.sstEnabled, sstRate: project.sstRate });
  const received = project.payments.reduce((t, p) => t.plus(p.amount), new Prisma.Decimal(0));
  const schedule = buildPaymentSchedule(
    project.paymentMilestones.map((m) => ({ id: m.id, label: m.label, percent: m.percent, dueDate: m.dueDate })),
    billableTotal,
    received,
    todayInMalaysia(),
  );

  // Photos: when taken (the phone's clock), which phase and trade, and where on site. Never GPS coordinates.
  const item = (p: (typeof project.photos)[number]) => {
    const taken = p.capturedAt ?? p.takenAt;
    return { id: p.id, caption: p.caption, takenAtText: formatDateTime(taken), takenAtMs: taken.getTime(), phase: p.phase, trade: p.trade, location: p.location, dayKey: klDay(taken) };
  };
  const progress = project.photos.filter((p) => p.kind === "PROGRESS").map(item);
  const plans = project.photos.filter((p) => p.kind === "FLOORPLAN").map(item);
  const logs = project.dailyLogs.map((log) => ({ ...log, photos: progress.filter((p) => p.dayKey === log.date.toISOString().slice(0, 10)) }));

  const orders = project.changeOrders.map((c) => ({
    id: c.id,
    description: c.description,
    dateText: formatDate(c.date),
    amountText: money(c.amount.toNumber()),
    status: c.status as "PENDING" | "APPROVED" | "REJECTED",
    decisionText:
      c.clientDecision && c.clientDecidedAt
        ? `${c.clientDecision === "APPROVED" ? "Approved" : "Rejected"} by you on ${formatDateTime(c.clientDecidedAt)}`
        : c.status === "APPROVED"
          ? "Approved by the contractor"
          : c.status === "REJECTED"
            ? "Rejected by the contractor"
            : null,
    canDecide: c.status === "PENDING" && !c.clientDecision,
  }));
  const selections = project.selections.map((x) => ({ id: x.id, category: x.category, name: x.name, details: x.details, photoId: x.photoId, approvedText: x.approvedAt ? formatDateTime(x.approvedAt) : null }));
  const waiting = orders.filter((o) => o.canDecide).length + selections.filter((s) => !s.approvedText).length;

  return (
    <>
      <PortalHeader title="Your project" home="/client/projects" signOutTo="/client/login" />
      <Link href="/client/projects" className="min-h-12 mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground print:hidden">
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

      <section className="mb-8" aria-label="Project stage">
        <h2 className="mb-3 text-base font-semibold">Where we are</h2>
        <Card className="p-4">
          <StageTracker stage={project.stage} />
        </Card>
      </section>

      {waiting > 0 ? (
        <section className="mb-8 rounded-xl border-2 border-accent/40 bg-accent-light/40 p-3" aria-label="Needs your decision">
          <h2 className="mb-1 text-base font-semibold">Needs your decision ({waiting})</h2>
          <p className="mb-3 text-sm text-muted-foreground">Please review these. Your answer is recorded with the date and time.</p>
        </section>
      ) : null}

      {orders.length > 0 ? (
        <section className="mb-8" aria-label="Change orders">
          <h2 className="mb-3 text-base font-semibold">Change orders</h2>
          <ChangeOrderApprovals rows={orders} />
        </section>
      ) : null}

      {selections.length > 0 ? (
        <section className="mb-8" aria-label="Product selections">
          <h2 className="mb-3 text-base font-semibold">Product selections</h2>
          <SelectionApprovals rows={selections} />
        </section>
      ) : null}

      <section className="mb-8" aria-label="Progress photos">
        <h2 className="mb-3 text-base font-semibold">Progress photos</h2>
        <PhotoGallery photos={progress} compare emptyText="No photos yet. Your contractor will add them as work progresses." />
      </section>

      {logs.length > 0 ? (
        <section className="mb-8" aria-label="Daily log">
          <h2 className="mb-3 text-base font-semibold">Daily log</h2>
          <ol className="space-y-4">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border bg-card p-3 shadow-sm" data-testid="daily-log">
                <h3 className="text-sm font-semibold">{formatDate(log.date)}</h3>
                <p className="mt-1 text-sm">{log.note}</p>
                {log.photos.length > 0 ? (
                  <div className="mt-3">
                    <PhotoGallery photos={log.photos} emptyText="" />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

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

      {schedule.length > 0 ? (
        <section className="mb-8" aria-label="Payment schedule">
          <h2 className="mb-3 text-base font-semibold">Payment schedule</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y" data-testid="payment-schedule">
              {schedule.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" data-testid="schedule-row">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {m.label} <span className="font-normal text-muted-foreground">({m.percent}%)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{m.dueDate ? `Due ${formatDate(m.dueDate)}` : "No due date"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold tabular-nums">{money(m.amount)}</span>
                    {m.overdue ? <Badge tone="red">Overdue</Badge> : null}
                    <Badge tone={scheduleTone[m.status]}>{scheduleLabel[m.status]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t bg-muted/40 px-4 py-2 text-sm text-muted-foreground" data-testid="schedule-received">
              Received so far: <span className="font-mono font-semibold text-foreground">{money(received.toDP(2).toNumber())}</span> of <span className="font-mono">{money(billableTotal)}</span>
            </p>
          </Card>
        </section>
      ) : null}
    </>
  );
}
