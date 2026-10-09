import { CreateProjectForm } from "@/components/forms/create-project-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Prisma } from "@prisma/client";
import { summarizeProject } from "@/lib/project-summary";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { ProjectCard } from "./project-card";
import { ProjectTable } from "./project-table";

export async function ProjectList({ onlyActive }: { onlyActive: boolean }) {
  const locale = await getLocale();
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

  return (
    <>
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
