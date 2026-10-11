import { FileText } from "lucide-react";
import { PortalHeader } from "@/components/portal/portal-header";
import { SubNav } from "@/components/portal/sub-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { documentWhereForSub } from "@/lib/document-access";
import { formatDateTime } from "@/lib/format";
import { subOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** The current drawings this subcontractor should build from: their trade, on projects they work on. */
export default async function SubDrawingsPage() {
  const { subcontractorId } = await subOrRedirect();
  const docs = await prisma.document.findMany({
    where: await documentWhereForSub(subcontractorId),
    include: { project: { select: { name: true } } },
    orderBy: [{ projectId: "asc" }, { uploadedAt: "desc" }],
  });
  const projects = [...new Set(docs.map((d) => d.project.name))];
  const now = Date.now();

  return (
    <>
      <PortalHeader title="Drawings" home="/sub/tasks" signOutTo="/login" />
      <SubNav />
      <p className="mb-4 text-xs text-muted-foreground" data-testid="drawings-loaded-at">
        Latest versions as of {formatDateTime(new Date())}. If you are offline, check for newer drawings when you have signal.
      </p>
      {docs.length === 0 ? (
        <EmptyState title="No drawings for you yet" hint="Drawings for your trade appear here once the contractor uploads them." />
      ) : (
        projects.map((project) => (
          <section key={project} aria-label={`Drawings for ${project}`} className="mb-6 space-y-2">
            <h2 className="text-sm font-semibold">{project}</h2>
            {docs
              .filter((d) => d.project.name === project)
              .map((doc) => (
                <a key={doc.id} href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer" className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="flex items-center gap-3 p-3 hover:border-primary/40">
                    <FileText className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Version {doc.version} · {formatDateTime(doc.uploadedAt)}
                        {doc.trade ? ` · ${doc.trade}` : ""}
                      </p>
                      {doc.note ? <p className="mt-0.5 text-xs">{doc.note}</p> : null}
                    </div>
                    {now - doc.uploadedAt.getTime() < WEEK ? <Badge tone="yellow">Latest Drawings</Badge> : null}
                  </Card>
                </a>
              ))}
          </section>
        ))
      )}
    </>
  );
}
