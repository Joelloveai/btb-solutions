import { CreateProjectForm } from "@/components/forms/create-project-form";
import { EmptyState } from "@/components/ui/empty-state";
import { calculateTotals } from "@/lib/calculations";
import { prisma } from "@/lib/prisma";
import { ProjectCard } from "./project-card";

export async function ProjectList({ onlyActive }: { onlyActive: boolean }) {
  const projects = await prisma.project.findMany({
    where: onlyActive ? { status: "ACTIVE" } : undefined,
    include: { costs: true, payments: true, changeOrders: true },
    orderBy: { createdAt: "desc" },
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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          id={project.id}
          name={project.name}
          clientName={project.clientName}
          contractValue={project.contractValue.toNumber()}
          totals={calculateTotals(project)}
        />
      ))}
    </div>
  );
}
