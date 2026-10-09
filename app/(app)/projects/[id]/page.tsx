import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { Badge } from "@/components/ui/badge";
import { summarizeProject, type ProjectSummary } from "@/lib/project-summary";
import { ReleaseRetentionButton } from "@/components/forms/release-retention-form";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { formatRM } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
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
    },
  });
  if (!project) notFound();
  const subcons = await prisma.subcontractor.findMany({ orderBy: { name: "asc" } });

  const { locale, t } = await getT();
  const money = (value: number) => formatRM(value, locale);
  const summary = summarizeProject(project);
  const totals = summary;
  const contractWithSst = new Prisma.Decimal(totals.revisedContractValue).plus(totals.sstAmount).toNumber();
  const inProfit = totals.profitLoss >= 0;
  const status = project.status as ProjectStatus;

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
      <Link href="/dashboard" className="text-sm font-medium text-brand">
        ← {t.dashboard}
      </Link>
      <header className="mb-5 mt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge tone={statusTone[status] ?? "gray"}>{PROJECT_STATUS_LABELS[status] ?? project.status}</Badge>
        </div>
        <p className="text-slate-600">
          {project.clientName ?? "No client set"} · Contract {money(contractWithSst)}
          {project.sstEnabled ? " (incl. SST)" : ""}
          {totals.approvedChangeOrders !== 0
            ? ` (incl. ${money(totals.approvedChangeOrders)} approved changes)`
            : ""}
        </p>
        {!project.clientId && project.clientName ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>This client is only a typed name.</span>
            <LinkClientButton projectId={project.id} />
          </div>
        ) : null}
        {project.sstEnabled ? (
          <p className="text-sm text-slate-600" data-testid="sst-line">
            SST ({Number(project.sstRate)}%): {money(totals.sstAmount)}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <EditProjectButton
            id={project.id}
            values={{
              name: project.name,
              clientId: project.clientId ?? "",
              contractValue: project.contractValue.toFixed(2),
              startDate: project.startDate ? project.startDate.toISOString().slice(0, 10) : "",
              sstEnabled: project.sstEnabled,
              retentionPercent: project.retentionPercent.toFixed(2),
              status: project.status as ProjectStatus,
            }}
          />
          <Link
            href={`/projects/${project.id}/claims`}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white hover:opacity-90"
          >
            Progress Claims
          </Link>
        </div>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Summary label="Total Costs" value={money(totals.totalCosts)} testId="total-costs" />
        <Summary label="Total Payments" value={money(totals.totalPayments)} testId="total-payments" />
        <div className={clsx("rounded-xl border p-4", inProfit ? "border-profit/30 bg-profit-light" : "border-loss/30 bg-loss-light")}>
          <p className="text-sm text-slate-600">Outstanding Balance</p>
          <p className="text-xl font-bold" data-testid="outstanding">
            {money(totals.outstandingBalance)}
          </p>
          <p className={clsx("mt-1 text-sm font-semibold", inProfit ? "text-profit-dark" : "text-loss-dark")}>
            {inProfit ? "Profit" : "Loss"}: <span data-testid="profit-loss">{money(totals.profitLoss)}</span>
          </p>
        </div>
      </div>

      <RetentionCard projectId={project.id} status={project.status} summary={summary} money={money} />

      <ProjectTabs
        projectId={project.id}
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
        }))}
      />
    </>
  );
}

function Summary({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-xl font-bold" data-testid={testId}>
        {value}
      </p>
    </div>
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
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4" aria-label="Retention">
      <h2 className="mb-2 font-bold">Retention</h2>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-slate-600">Total Retention Held</dt>
          <dd className="font-bold" data-testid="retention-held">{money(summary.retentionHeld)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Retention Released</dt>
          <dd className="font-bold" data-testid="retention-released">{money(summary.retentionReleased)}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Retention Outstanding</dt>
          <dd className="font-bold text-pending-dark" data-testid="retention-outstanding">{money(summary.retentionOutstanding)}</dd>
        </div>
      </dl>
      {canRelease ? (
        <div className="mt-3">
          <ReleaseRetentionButton projectId={projectId} outstanding={summary.retentionOutstanding} />
        </div>
      ) : summary.retentionOutstanding > 0 ? (
        <p className="mt-2 text-sm text-slate-600">Mark the project as Completed to release retention.</p>
      ) : null}
    </section>
  );
}
