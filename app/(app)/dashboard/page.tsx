import { CreateProjectForm } from "@/components/forms/create-project-form";
import { requireFinancialsPage } from "@/lib/guards";
import { getT } from "@/lib/locale";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireFinancialsPage();
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
