import { CreateProjectForm } from "@/components/forms/create-project-form";
import { getT } from "@/lib/locale";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t.dashboard}>
        <CreateProjectForm />
      </PageHeader>
      <ProjectList onlyActive showKpis />
    </>
  );
}
