import { CreateProjectForm } from "@/components/forms/create-project-form";
import { getT } from "@/lib/locale";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t.projects}>
        <CreateProjectForm />
      </PageHeader>
      <ProjectList onlyActive={false} />
    </>
  );
}
