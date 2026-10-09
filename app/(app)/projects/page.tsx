import { CreateProjectForm } from "@/components/forms/create-project-form";
import { getT } from "@/lib/locale";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { t } = await getT();
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.projects}</h1>
        <CreateProjectForm />
      </div>
      <ProjectList onlyActive={false} />
    </>
  );
}
