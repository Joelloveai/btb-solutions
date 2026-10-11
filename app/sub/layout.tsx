import { getServerSession } from "next-auth";
import { CompanyBar } from "@/components/layout/company-bar";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { CaptureFab } from "@/components/capture/capture-fab";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The subcontractor page is a small phone-first shell: company strip, then the task list.
export default async function SubLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { subcontractorId: true } }) : null;
  const openTasks = me?.subcontractorId
    ? await prisma.task.findMany({ where: { subcontractorId: me.subcontractorId, status: "OPEN" }, orderBy: { dueDate: "asc" }, take: 30, include: { project: { select: { id: true, name: true } } } })
    : [];
  const projects = me?.subcontractorId
    ? await prisma.project.findMany({ where: { OR: [{ tasks: { some: { subcontractorId: me.subcontractorId } } }, { punchItems: { some: { subcontractorId: me.subcontractorId } } }] }, select: { id: true, name: true }, take: 40 })
    : [];
  return (
    <OfflineProvider userKey={`sub:${session?.user?.id ?? "unknown"}`} warmUrls={["/sub/tasks", "/sub/punch", "/sub/drawings"]}>
      <div className="flex min-h-screen flex-col bg-background print:min-h-0 print:bg-white">
        <div className="print:hidden">
          <CompanyBar />
          <OfflineIndicator />
        </div>
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-5">{children}</div>
        <CaptureFab role="sub" projects={projects} tasks={openTasks.map((t) => ({ id: t.id, description: t.description, projectId: t.project.id, projectName: t.project.name }))} />
      </div>
    </OfflineProvider>
  );
}
