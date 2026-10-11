import { PendingOps } from "@/components/offline/pending-ops";
import { ImageViewer } from "@/components/photos/image-viewer";
import { PortalHeader } from "@/components/portal/portal-header";
import { PunchDoneForm } from "@/components/punch/punch-done-form";
import { SubNav } from "@/components/portal/sub-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PUNCH_STATUS_LABELS, type PunchStatus } from "@/lib/constants";
import { formatDate, formatDateTime, todayInMalaysia } from "@/lib/format";
import { subOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Defects the contractor has assigned to this subcontractor, across every project. */
export default async function SubPunchPage() {
  const { subcontractorId, user } = await subOrRedirect();
  const sub = await prisma.subcontractor.findUnique({ where: { id: subcontractorId } });
  const items = await prisma.punchItem.findMany({
    where: { subcontractorId },
    include: { project: { select: { name: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  const today = todayInMalaysia();
  const open = items.filter((i) => i.status === "OPEN");
  const rest = items.filter((i) => i.status !== "OPEN");

  return (
    <>
      <PortalHeader title="My punch list" home="/sub/tasks" signOutTo="/login" />
      <SubNav />
      <p className="mb-4 text-sm text-muted-foreground">
        {sub?.name ?? user.email} · {open.length} to fix
      </p>

      <PendingOps types={["resolvePunch"]} />

      <section aria-label="Open punch items" className="space-y-3">
        {open.length === 0 ? (
          <EmptyState title="Nothing to fix" hint="Defects the contractor assigns to you will appear here." />
        ) : (
          open.map((item) => {
            const overdue = !!item.dueDate && item.dueDate < today;
            return (
              <Card key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-snug">{item.location}</p>
                    <p className="text-sm">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{item.project.name}</p>
                  </div>
                  <Badge tone={overdue ? "red" : "yellow"}>{overdue ? "Overdue" : "Open"}</Badge>
                </div>
                {item.dueDate ? <p className="mt-1 text-sm">Due {formatDate(item.dueDate)}</p> : null}
                {item.photoId ? (
                  <div className="mt-2 w-28">
                    <ImageViewer id={item.photoId} title={`Defect: ${item.description}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/photos/${item.photoId}`} alt={`Defect: ${item.description}`} className="aspect-[4/3] w-full object-cover" />
                    </ImageViewer>
                  </div>
                ) : null}
                <PunchDoneForm punchId={item.id} label={item.description} trade={item.trade} location={item.location} />
              </Card>
            );
          })
        )}
      </section>

      {rest.length > 0 ? (
        <section aria-label="Fixed punch items" className="mt-8 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Fixed</h2>
          {rest.map((item) => (
            <Card key={item.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.location}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.description} · fixed {item.resolvedAt ? formatDateTime(item.resolvedAt) : ""}
                </p>
              </div>
              <Badge tone={item.status === "CLOSED" ? "green" : "blue"}>{PUNCH_STATUS_LABELS[item.status as PunchStatus]}</Badge>
            </Card>
          ))}
        </section>
      ) : null}
    </>
  );
}
