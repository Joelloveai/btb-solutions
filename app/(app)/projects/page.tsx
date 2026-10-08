import { CreateProjectForm } from "@/components/forms/create-project-form";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">All Projects</h1>
        <CreateProjectForm />
      </div>
      <ProjectList onlyActive={false} />
    </>
  );
}
