import Link from "next/link";
import { staffCan } from "@/lib/auth";
import { CreateProjectForm } from "@/components/forms/create-project-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Prisma } from "@prisma/client";
import { summarizeProject } from "@/lib/project-summary";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { ProjectCard } from "./project-card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatRM } from "@/lib/format";
import { ProjectTable } from "./project-table";

export async function ProjectList({ onlyActive, showKpis = false }: { onlyActive: boolean; showKpis?: boolean }) {
  const locale = await getLocale();
  // Site supervisors get the list of jobs without any of the money.
  if (!(await staffCan("financials.view"))) {
    const names = await prisma.project.findMany({ where: onlyActive ? { status: "ACTIVE" } : undefined, select: { id: true, name: true, clientName: true, status: true }, orderBy: { updatedAt: "desc" } });
    return names.length === 0 ? (
      <EmptyState title="No projects yet" hint="Projects you can work on will appear here." />
    ) : (
      <ul className="grid gap-3 sm:grid-cols-2">
        {names.map((p) => (
          <li key={p.id}>
            <Link href={`/projects/${p.id}`} className="block rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <h2 className="font-semibold leading-snug">{p.name}</h2>
              {p.clientName ? <p className="text-sm text-muted-foreground">{p.clientName}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  const projects = await prisma.project.findMany({
    where: onlyActive ? { status: "ACTIVE" } : undefined,
    include: { costs: true, payments: true, changeOrders: true, claims: true },
  });

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        hint="Create your first project to start tracking costs and payments."
        action={<CreateProjectForm />}
      />
    );
  }

  // Contract value shown includes SST when the project has it turned on.
  const rows = projects.map((project) => {
    const totals = summarizeProject(project);
    const contractValue = project.contractValue.plus(new Prisma.Decimal(totals.sstAmount)).toNumber();
    return { project, totals, contractValue };
  });

  rows.sort((a, b) => b.totals.realProfit - a.totals.realProfit);

  // Portfolio totals are Decimal sums of the same per-project figures shown below.
  const sum = (pick: (r: (typeof rows)[number]) => number) =>
    rows.reduce((t, r) => t.plus(pick(r)), new Prisma.Decimal(0)).toDP(2).toNumber();
  const portfolio = {
    contract: sum((r) => r.contractValue),
    cash: sum((r) => r.totals.totalPayments),
    outstanding: sum((r) => r.totals.outstandingBalance),
    profit: sum((r) => r.totals.realProfit),
  };

  return (
    <>
      {showKpis ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Contract Value" value={formatRM(portfolio.contract, locale)} hint={`${rows.length} active`} />
          <KpiCard label="Cash Received" value={formatRM(portfolio.cash, locale)} />
          <KpiCard label="Outstanding" value={formatRM(portfolio.outstanding, locale)} tone="pending" />
          <KpiCard label="Real Profit" value={formatRM(portfolio.profit, locale)} tone={portfolio.profit >= 0 ? "profit" : "loss"} />
        </div>
      ) : null}
      <div className="hidden md:block">
        <ProjectTable
          locale={locale}
          rows={rows.map(({ project, totals, contractValue }) => ({
            id: project.id,
            name: project.name,
            clientName: project.clientName,
            status: project.status,
            sstEnabled: project.sstEnabled,
            contractValue,
            summary: totals,
          }))}
        />
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map(({ project, totals, contractValue }) => (
          <ProjectCard
            key={project.id}
            id={project.id}
            name={project.name}
            clientName={project.clientName}
            contractValue={contractValue}
            totals={totals}
            locale={locale}
          />
        ))}
      </div>
    </>
  );
}
