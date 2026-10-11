import { notFound } from "next/navigation";
import { Letterhead } from "@/components/layout/letterhead";
import { PrintButton } from "@/components/print-button";
import { PUNCH_STATUS_LABELS, type PunchStatus } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { groupPunchItems } from "@/lib/punch";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * The closeout walk sheet: every punch item not yet closed, grouped by trade and then by place, with a
 * tick box for each so the contractor can verify as they walk. Open items first, then those awaiting a check.
 */
export default async function PunchPrintPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { punchItems: { where: { status: { not: "CLOSED" } }, orderBy: { createdAt: "asc" }, include: { subcontractor: true } } },
  });
  if (!project) notFound();
  const locale = await getLocale();
  const groups = groupPunchItems(project.punchItems);
  const openCount = project.punchItems.filter((i) => i.status === "OPEN").length;
  const toVerify = project.punchItems.length - openCount;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="rounded-xl border bg-card p-6 print:rounded-none print:border-0 print:p-0">
        <Letterhead />
        <h2 className="mt-4 text-lg font-bold uppercase tracking-wide">Punch list</h2>
        <dl className="mb-4 mt-2 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Project</dt>
          <dd className="font-semibold">{project.name}</dd>
          <dt className="text-muted-foreground">Printed</dt>
          <dd className="font-semibold">{formatDateTime(new Date(), locale)}</dd>
          <dt className="text-muted-foreground">Still to fix</dt>
          <dd className="font-semibold">{openCount}</dd>
          <dt className="text-muted-foreground">Fixed, to verify</dt>
          <dd className="font-semibold">{toVerify}</dd>
        </dl>

        {groups.length === 0 ? <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No open punch items. Nothing to walk.</p> : null}

        {groups.map((group) => (
          <section key={group.trade} className="mb-5 print:break-inside-avoid-page" aria-label={`${group.trade} punch items`}>
            <h3 className="border-b-2 border-brand pb-1 text-base font-bold">{group.trade}</h3>
            {group.locations.map((place) => (
              <div key={place.location} className="mt-3 print:break-inside-avoid">
                <p className="text-sm font-semibold">{place.location}</p>
                <table className="mt-1 w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="w-16 py-1 font-semibold">Photo</th>
                      <th className="py-1 font-semibold">Defect</th>
                      <th className="py-1 font-semibold">Assigned</th>
                      <th className="py-1 font-semibold">Due</th>
                      <th className="py-1 font-semibold">Status</th>
                      <th className="w-14 py-1 text-center font-semibold">Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {place.items.map((item) => {
                      const full = project.punchItems.find((i) => i.id === item.id)!;
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="py-1.5">
                            {full.photoId ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={`/api/photos/${full.photoId}`} alt="" className="h-12 w-14 rounded object-cover" />
                            ) : null}
                          </td>
                          <td className="py-1.5 pr-2">{full.description}</td>
                          <td className="py-1.5 pr-2">{full.subcontractor?.name ?? "—"}</td>
                          <td className="py-1.5 pr-2">{full.dueDate ? formatDate(full.dueDate, locale) : "—"}</td>
                          <td className="py-1.5 pr-2">{PUNCH_STATUS_LABELS[full.status as PunchStatus]}</td>
                          <td className="py-1.5 text-center">
                            <span className="inline-block h-5 w-5 rounded border-2 border-foreground align-middle" aria-label="Tick when verified" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
