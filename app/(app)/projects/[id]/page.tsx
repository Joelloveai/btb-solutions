import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { Badge } from "@/components/ui/badge";
import { calculateTotals } from "@/lib/calculations";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { formatRM } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusTone = { ACTIVE: "green", COMPLETED: "blue", ON_HOLD: "yellow", CANCELLED: "gray" } as const;

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      costs: { orderBy: { date: "desc" } },
      payments: { orderBy: { date: "desc" } },
      changeOrders: { orderBy: { date: "desc" } },
    },
  });
  if (!project) notFound();

  const totals = calculateTotals(project);
  const inProfit = totals.profitLoss >= 0;
  const status = project.status as ProjectStatus;

  return (
    <>
      <Link href="/dashboard" className="text-sm font-medium text-brand">
        ← Dashboard
      </Link>
      <header className="mb-5 mt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge tone={statusTone[status] ?? "gray"}>{PROJECT_STATUS_LABELS[status] ?? project.status}</Badge>
        </div>
        <p className="text-gray-600">
          {project.clientName ?? "No client set"} · Contract {formatRM(totals.revisedContractValue)}
          {totals.approvedChangeOrders !== 0
            ? ` (incl. ${formatRM(totals.approvedChangeOrders)} approved changes)`
            : ""}
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Summary label="Total Costs" value={formatRM(totals.totalCosts)} testId="total-costs" />
        <Summary label="Total Payments" value={formatRM(totals.totalPayments)} testId="total-payments" />
        <div className={clsx("rounded-xl border p-4", inProfit ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
          <p className="text-sm text-gray-600">Outstanding Balance</p>
          <p className="text-xl font-bold" data-testid="outstanding">
            {formatRM(totals.outstandingBalance)}
          </p>
          <p className={clsx("mt-1 text-sm font-semibold", inProfit ? "text-green-700" : "text-red-700")}>
            {inProfit ? "Profit" : "Loss"}: <span data-testid="profit-loss">{formatRM(totals.profitLoss)}</span>
          </p>
        </div>
      </div>

      <ProjectTabs
        projectId={project.id}
        costs={project.costs.map((c) => ({
          id: c.id,
          date: c.date.toISOString(),
          category: c.category,
          description: c.description,
          amount: c.amount.toNumber(),
          vendor: c.vendor,
        }))}
        payments={project.payments.map((p) => ({
          id: p.id,
          date: p.date.toISOString(),
          amount: p.amount.toNumber(),
          reference: p.reference,
        }))}
        changeOrders={project.changeOrders.map((c) => ({
          id: c.id,
          date: c.date.toISOString(),
          description: c.description,
          amount: c.amount.toNumber(),
          status: c.status,
        }))}
      />
    </>
  );
}

function Summary({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-xl font-bold" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}
