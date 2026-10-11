import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { linkButton } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { summarizeProject, type ProjectSummary } from "@/lib/project-summary";
import { ReleaseRetentionButton } from "@/components/forms/release-retention-form";
import { CATEGORY_LABELS, PROJECT_STATUS_LABELS, type ProjectStatus, type PunchStatus } from "@/lib/constants";
import { formatDate, formatDateTime, formatRM, todayInMalaysia } from "@/lib/format";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { reminderLink } from "@/lib/whatsapp";
import { LoginAccess } from "@/components/portal/login-access";
import { OfflineSnapshot } from "@/components/offline/offline-snapshot";
import { getT } from "@/lib/locale";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evidenceQuality } from "@/lib/evidence-quality";
import { fetchTimelinePage } from "@/lib/timeline-query";
import { Prisma } from "@prisma/client";
import { LinkClientButton } from "@/components/clients/link-client-button";
import { EditProjectButton } from "@/components/forms/edit-project-form";

export const dynamic = "force-dynamic";

const statusTone = { ACTIVE: "blue", COMPLETED: "gray", ON_HOLD: "yellow", CANCELLED: "gray" } as const;

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      costs: { orderBy: { date: "desc" } },
      payments: { orderBy: { date: "desc" } },
      changeOrders: { orderBy: { date: "desc" } },
      boqLines: { orderBy: { position: "asc" } },
      claims: { orderBy: { number: "asc" }, include: { payments: true } },
      photos: { orderBy: { takenAt: "desc" } },
      tasks: { orderBy: { dueDate: "asc" }, include: { subcontractor: true } },
      punchItems: { orderBy: { createdAt: "desc" }, include: { subcontractor: true } },
      documents: { orderBy: [{ nameKey: "asc" }, { version: "desc" }] },
      selections: { orderBy: { createdAt: "asc" } },
      dailyLogs: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
      paymentMilestones: { orderBy: { position: "asc" } },
    },
  });
  if (!project) notFound();
  const timeline = await fetchTimelinePage(project.id, "all");
  const quality = evidenceQuality(project.photos, project.costs);
  const viewerId = (await getServerSession(authOptions))?.user?.id ?? null;
  const diaries = await prisma.siteDiary.findMany({ where: { projectId: project.id }, orderBy: { date: "desc" } });
  const uploaderEmails = new Map(
    (await prisma.user.findMany({ where: { id: { in: project.documents.map((d) => d.uploadedById).filter((id): id is string => !!id) } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]),
  );
  const portalUsers = project.clientId
    ? await prisma.clientUser.findMany({ where: { clientId: project.clientId }, orderBy: { createdAt: "asc" } })
    : [];
  const subcons = await prisma.subcontractor.findMany({ orderBy: { name: "asc" } });

  const { locale, t } = await getT();
  const money = (value: number) => formatRM(value, locale);
  const summary = summarizeProject(project);
  const totals = summary;
  const contractWithSst = new Prisma.Decimal(totals.revisedContractValue).plus(totals.sstAmount).toNumber();
  const inProfit = totals.profitLoss >= 0;
  const status = project.status as ProjectStatus;
  // Photos show when they were TAKEN (the phone's clock) and say so when they reached the server much later.
  const toPhotoItem = (p: (typeof project.photos)[number]) => {
    const taken = p.capturedAt ?? p.takenAt;
    const lateMs = p.capturedAt ? p.createdAt.getTime() - p.capturedAt.getTime() : 0;
    const hasGps = p.latitude !== null && p.longitude !== null;
    return {
      id: p.id,
      caption: p.caption,
      takenAtText: formatDateTime(taken, locale),
      takenAtMs: taken.getTime(),
      uploadedLaterText: lateMs > 30 * 60 * 1000 ? formatDateTime(p.createdAt, locale) : null,
      phase: p.phase,
      trade: p.trade,
      location: p.location,
      gps: hasGps
        ? {
            text: `${p.latitude!.toFixed(5)}, ${p.longitude!.toFixed(5)}${p.accuracy !== null ? ` ±${Math.round(p.accuracy)} m` : ""}`,
            href: `https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=18/${p.latitude}/${p.longitude}`,
          }
        : null,
    };
  };
  // "Latest Drawings": a current drawing uploaded within the last week, so people know to look.
  const hasLatestDrawings = project.documents.some((d) => d.isCurrent && d.type === "Drawing" && Date.now() - d.uploadedAt.getTime() < 7 * 24 * 60 * 60 * 1000);
  // The client's payment schedule, worked out from the payments already recorded (nothing is entered twice).
  const receivedTotal = project.payments.reduce((t, p) => t.plus(p.amount), new Prisma.Decimal(0));
  const schedule = buildPaymentSchedule(
    project.paymentMilestones.map((m) => ({ id: m.id, label: m.label, percent: m.percent, dueDate: m.dueDate })),
    totals.billableTotal,
    receivedTotal,
    todayInMalaysia(),
  );
  const progressPhotos = project.photos.filter((p) => p.kind === "PROGRESS");
  const checklistCounts: Record<string, number> = {};
  for (const photo of progressPhotos) if (photo.checklistItem) checklistCounts[photo.checklistItem] = (checklistCounts[photo.checklistItem] ?? 0) + 1;

  const boqLabel = (id: string | null) => {
    const i = project.boqLines.findIndex((b) => b.id === id);
    return i < 0 ? null : `${i + 1}. ${project.boqLines[i].description}`;
  };
  const approvedFor = (lineId: string) =>
    project.changeOrders.filter((c) => c.status === "APPROVED" && c.boqLineId === lineId).reduce((t, c) => t.plus(c.amount), new Prisma.Decimal(0));
  const actualFor = (lineId: string) =>
    project.costs.filter((c) => c.boqLineId === lineId).reduce((t, c) => t.plus(c.amount), new Prisma.Decimal(0));
  const boqRows = project.boqLines.map((b) => {
    const budget = b.amount.plus(approvedFor(b.id));
    const actual = actualFor(b.id);
    return {
      id: b.id,
      description: b.description,
      qty: b.qty.toString(),
      unit: b.unit,
      rate: b.rate.toNumber(),
      amount: b.amount.toNumber(),
      budget: budget.toNumber(),
      actual: actual.toNumber(),
      remaining: budget.minus(actual).toNumber(),
    };
  });
  const unallocatedActual = project.costs.filter((c) => !c.boqLineId).reduce((t, c) => t.plus(c.amount), new Prisma.Decimal(0)).toNumber();
  const lookups = {
    boqLines: project.boqLines.map((b, i) => ({ id: b.id, label: `${i + 1}. ${b.description}` })),
    subcons: subcons.map((s) => ({ id: s.id, name: s.name })),
    // All claims, not just unpaid ones, so editing a payment never silently unlinks it.
    claims: project.claims.map((c) => ({ id: c.id, label: `Claim ${c.number} · ${formatRM(c.netClaim.toNumber(), locale)}` })),
  };

  return (
    <>
      <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {t.dashboard}
      </Link>
      <PageHeader
        title={project.name}
        description={
          <>
            {project.clientName ?? "No client set"} · Contract {money(contractWithSst)}
            {project.sstEnabled ? " (incl. SST)" : ""}
            {totals.approvedChangeOrders !== 0 ? ` (incl. ${money(totals.approvedChangeOrders)} approved changes)` : ""}
          </>
        }
      >
        <Badge tone={statusTone[status] ?? "gray"}>{PROJECT_STATUS_LABELS[status] ?? project.status}</Badge>
        {hasLatestDrawings ? <Badge tone="yellow">Latest Drawings</Badge> : null}
        <EditProjectButton
          id={project.id}
          values={{
            name: project.name,
            clientId: project.clientId ?? "",
            contractValue: project.contractValue.toFixed(2),
            contractRef: project.contractRef ?? "",
            startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : "",
            sstEnabled: project.sstEnabled,
            retentionPercent: project.retentionPercent.toFixed(2),
            status: project.status as ProjectStatus,
          }}
        />
        <Link href={`/projects/${project.id}/claims`} className={linkButton("accent", true)}>
          Progress Claims
        </Link>
        <a href={`/api/projects/${project.id}/cipaa-pack`} className={linkButton("secondary", true)}>
          Generate CIPAA Pack
        </a>
      </PageHeader>
      {!project.clientId && project.clientName ? (
        <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>This client is only a typed name.</span>
          <LinkClientButton projectId={project.id} />
        </div>
      ) : null}
      {project.sstEnabled ? (
        <p className="-mt-3 mb-4 text-sm text-muted-foreground" data-testid="sst-line">
          SST ({Number(project.sstRate)}%): {money(totals.sstAmount)}
        </p>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:mb-6 sm:grid-cols-3 sm:gap-3">
        <KpiCard label="Total Costs" value={money(totals.totalCosts)} testId="total-costs" />
        <KpiCard label="Total Payments" value={money(totals.totalPayments)} testId="total-payments" />
        <div
          className={clsx(
            "col-span-2 rounded-xl border p-3 shadow-sm sm:col-span-1 sm:p-4",
            inProfit ? "border-profit/25 bg-profit-light" : "border-loss/25 bg-loss-light",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">Outstanding Balance</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums sm:text-xl lg:text-2xl" data-testid="outstanding">
            {money(totals.outstandingBalance)}
          </p>
          <p className={clsx("mt-1 text-sm font-semibold", inProfit ? "text-profit-dark" : "text-loss-dark")}>
            {inProfit ? "Profit" : "Loss"}: <span className="font-mono tabular-nums" data-testid="profit-loss">{money(totals.profitLoss)}</span>
          </p>
        </div>
      </div>

      {project.clientId ? (
        <LoginAccess
          title="Client portal access"
          description="Lets this client see progress photos, floor plans and the timeline. They never see costs or claims."
          loginPath="/client/login"
          users={portalUsers.map((u) => ({ id: u.id, email: u.email, name: u.name }))}
          kind="client"
          ownerId={project.clientId}
        />
      ) : null}

      <RetentionCard projectId={project.id} status={project.status} summary={summary} money={money} />

      <OfflineSnapshot
        data={{
          projectId: project.id,
          name: project.name,
          costs: project.costs.slice(0, 100).map((c) => ({
            id: c.id,
            dateText: formatDate(c.date, locale),
            category: CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] ?? c.category,
            description: c.description,
            amountText: money(c.amount.toNumber()),
          })),
          payments: project.payments.slice(0, 100).map((p) => ({ id: p.id, dateText: formatDate(p.date, locale), amountText: money(p.amount.toNumber()), reference: p.reference })),
          tasks: project.tasks.slice(0, 100).map((t) => ({
            id: t.id,
            description: t.description,
            dueText: formatDate(t.dueDate, locale),
            status: t.status,
            subcontractorName: t.subcontractor?.name ?? null,
          })),
          photos: progressPhotos.map((p) => ({ id: p.id, caption: p.caption, takenAtText: toPhotoItem(p).takenAtText })),
        }}
      />

      <p className="mb-3 rounded-lg border bg-card px-3 py-2 text-sm" data-testid="evidence-quality">
        <span className="font-medium">Evidence quality: {quality.percent === null ? "nothing recorded yet" : `${quality.percent}%`}</span>
        {quality.percent !== null && quality.percent < 100 ? (
          <span className="text-muted-foreground">
            {" "}
            · {quality.photosMissingLocation > 0 ? `${quality.photosMissingLocation} photo${quality.photosMissingLocation === 1 ? "" : "s"} without a location` : ""}
            {quality.photosMissingLocation > 0 && quality.costsMissingReference > 0 ? ", " : ""}
            {quality.costsMissingReference > 0 ? `${quality.costsMissingReference} cost${quality.costsMissingReference === 1 ? "" : "s"} without an invoice reference` : ""}
          </span>
        ) : null}
      </p>
      <ProjectTabs
        projectId={project.id}
        timeline={timeline}
        materialCosts={project.costs.filter((c) => c.category === "MATERIAL").map((c) => ({ dateKey: c.date.toISOString().slice(0, 10), description: c.description }))}
        diaries={diaries.map((d) => ({
          id: d.id,
          dateKey: d.date.toISOString().slice(0, 10),
          dateText: formatDate(d.date, locale),
          weather: d.weather,
          locked: d.status === "LOCKED",
          preparedBy: d.preparedBy,
          preparedAtText: formatDateTime(d.preparedAt, locale),
          verifiedBy: d.verifiedBy,
          verifiedAtText: d.verifiedAt ? formatDateTime(d.verifiedAt, locale) : null,
          canCountersign: d.status !== "LOCKED" && d.preparedById !== viewerId,
        }))}
        photos={progressPhotos.map(toPhotoItem)}
        checklistCounts={checklistCounts}
        floorPlans={project.photos.filter((p) => p.kind === "FLOORPLAN").map(toPhotoItem)}
        documents={project.documents.map((d) => ({
          id: d.id,
          name: d.name,
          nameKey: d.nameKey,
          type: d.type,
          trade: d.trade,
          version: d.version,
          isCurrent: d.isCurrent,
          fileName: d.fileName,
          sizeText: d.size < 1024 * 1024 ? `${Math.max(1, Math.round(d.size / 1024))} KB` : `${(d.size / (1024 * 1024)).toFixed(1)} MB`,
          note: d.note,
          uploadedByText: (d.uploadedById && uploaderEmails.get(d.uploadedById)) || "—",
          uploadedAtText: formatDateTime(d.uploadedAt, locale),
          uploadedAtMs: d.uploadedAt.getTime(),
        }))}
        clientView={{
          projectId: project.id,
          hasClient: !!project.clientId,
          stage: project.stage ?? "",
          milestones: schedule.map((m) => ({
            id: m.id,
            label: m.label,
            percent: m.percent,
            amountText: money(m.amount),
            paidText: money(m.paid),
            status: m.status,
            overdue: m.overdue,
            dueText: m.dueDate ? formatDate(m.dueDate, locale) : null,
          })),
          selections: project.selections.map((x) => ({
            id: x.id,
            category: x.category,
            name: x.name,
            details: x.details,
            photoId: x.photoId,
            approvedText: x.approvedAt ? formatDateTime(x.approvedAt, locale) : null,
          })),
          logs: project.dailyLogs.map((l) => ({ id: l.id, dateText: formatDate(l.date, locale), note: l.note })),
        }}
        punch={project.punchItems.map((item) => ({
          id: item.id,
          location: item.location,
          description: item.description,
          trade: item.trade,
          status: item.status as PunchStatus,
          subcontractorId: item.subcontractorId,
          subcontractorName: item.subcontractor?.name ?? null,
          dueText: item.dueDate ? formatDate(item.dueDate, locale) : null,
          overdue: !!item.dueDate && item.dueDate < todayInMalaysia(),
          photoId: item.photoId,
          resolvedPhotoId: item.resolvedPhotoId,
          resolvedText: item.resolvedAt ? formatDateTime(item.resolvedAt, locale) : null,
        }))}
        tasks={project.tasks.map((task) => ({
          id: task.id,
          description: task.description,
          isMilestone: task.isMilestone,
          subcontractorName: task.subcontractor?.name ?? null,
          dueText: formatDate(task.dueDate, locale),
          status: task.status as "OPEN" | "DONE",
          overdue: task.status === "OPEN" && task.dueDate < todayInMalaysia(),
          completedText: task.completedAt ? formatDateTime(task.completedAt, locale) : null,
          photoId: task.photoId,
          hasSub: !!task.subcontractor,
          reminderHref: task.subcontractor
            ? reminderLink({
                phone: task.subcontractor.contact,
                name: task.subcontractor.name,
                task: task.description,
                project: project.name,
                due: formatDate(task.dueDate, "en"),
                appUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
              })
            : null,
        }))}
        lookups={lookups}
        boq={boqRows}
        unallocatedActual={unallocatedActual}
        costs={project.costs.map((c) => ({
          id: c.id,
          date: c.date.toISOString(),
          category: c.category,
          description: c.description,
          amount: c.amount.toNumber(),
          vendor: c.vendor,
          reference: c.reference,
          subcontractorId: c.subcontractorId,
          subconName: subcons.find((s) => s.id === c.subcontractorId)?.name ?? null,
          boqLineId: c.boqLineId,
          boqLabel: boqLabel(c.boqLineId),
          paidAt: c.paidAt ? c.paidAt.toISOString() : null,
        }))}
        payments={project.payments.map((p) => ({
          id: p.id,
          date: p.date.toISOString(),
          amount: p.amount.toNumber(),
          reference: p.reference,
          claimId: p.claimId,
          claimNumber: project.claims.find((c) => c.id === p.claimId)?.number ?? null,
        }))}
        changeOrders={project.changeOrders.map((c) => ({
          id: c.id,
          date: c.date.toISOString(),
          description: c.description,
          amount: c.amount.toNumber(),
          status: c.status,
          boqLineId: c.boqLineId,
          boqLabel: boqLabel(c.boqLineId),
          sentText: c.sentToClientAt ? formatDateTime(c.sentToClientAt, locale) : null,
          clientDecisionText: c.clientDecision && c.clientDecidedAt ? `${c.clientDecision === "APPROVED" ? "Approved" : "Rejected"} by client ${formatDateTime(c.clientDecidedAt, locale)}` : null,
          canSend: !!project.clientId && c.status === "PENDING" && !c.sentToClientAt,
        }))}
      />
    </>
  );
}

function RetentionCard({
  projectId,
  status,
  summary,
  money,
}: {
  projectId: string;
  status: string;
  summary: ProjectSummary;
  money: (n: number) => string;
}) {
  if (summary.retentionHeld === 0 && summary.retentionReleased === 0) return null;
  const canRelease = status === "COMPLETED" && summary.retentionOutstanding > 0;
  return (
    <Card className="mb-4 p-3 sm:mb-6 sm:p-4" aria-label="Retention" role="region">
      <h2 className="mb-2 text-sm font-semibold">Retention</h2>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Total Retention Held</dt>
          <dd className="whitespace-nowrap font-mono text-sm font-bold sm:text-base" data-testid="retention-held">{money(summary.retentionHeld)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Retention Released</dt>
          <dd className="whitespace-nowrap font-mono text-sm font-bold sm:text-base" data-testid="retention-released">{money(summary.retentionReleased)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Retention Outstanding</dt>
          <dd className="whitespace-nowrap font-mono text-sm font-bold text-pending-dark sm:text-base" data-testid="retention-outstanding">{money(summary.retentionOutstanding)}</dd>
        </div>
      </dl>
      {canRelease ? (
        <div className="mt-3">
          <ReleaseRetentionButton projectId={projectId} outstanding={summary.retentionOutstanding} />
        </div>
      ) : summary.retentionOutstanding > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Mark the project as Completed to release retention.</p>
      ) : null}
    </Card>
  );
}
