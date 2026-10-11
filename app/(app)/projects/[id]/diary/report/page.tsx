import Link from "next/link";
import { notFound } from "next/navigation";
import { Letterhead } from "@/components/layout/letterhead";
import { PrintButton } from "@/components/print-button";
import { formatDate, formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const kl = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
const shift = (key: string, days: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};
const valid = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/**
 * Printable weekly/monthly summary of the site diaries, for JKR, the local authority or the client.
 * Defaults to the last 7 days; ?range=month gives the last 30; ?from= and ?to= give any period.
 */
export default async function DiaryReportPage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string; to?: string; range?: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) notFound();
  const locale = await getLocale();
  const to = valid(searchParams.to) ?? kl();
  const from = valid(searchParams.from) ?? shift(to, searchParams.range === "month" ? -29 : -6);
  const diaries = await prisma.siteDiary.findMany({
    where: { projectId: project.id, date: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) } },
    orderBy: { date: "asc" },
  });
  const rows = diaries.map((d) => {
    const manpower = Object.values(JSON.parse(d.manpower) as Record<string, number>).reduce((t, n) => t + n, 0);
    return { d, manpower, machinery: JSON.parse(d.machinery) as string[], materials: JSON.parse(d.materialsIn) as { description: string }[] };
  });
  const rainDays = diaries.filter((d) => d.weather === "Rain" || d.weather === "Heavy rain").length;
  const manDays = rows.reduce((t, r) => t + r.manpower, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <nav className="flex gap-3 text-sm" aria-label="Period">
          <Link className="min-h-12 content-center underline" href={`/projects/${project.id}/diary/report`}>Last 7 days</Link>
          <Link className="min-h-12 content-center underline" href={`/projects/${project.id}/diary/report?range=month`}>Last 30 days</Link>
        </nav>
        <PrintButton />
      </div>
      <article className="rounded-xl border bg-card p-6 print:rounded-none print:border-0 print:p-0">
        <Letterhead />
        <h2 className="mt-4 text-lg font-bold uppercase tracking-wide">Site diary summary</h2>
        <dl className="mb-4 mt-2 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Project</dt>
          <dd className="font-semibold">{project.name}</dd>
          <dt className="text-muted-foreground">Period</dt>
          <dd className="font-semibold">{formatDate(new Date(`${from}T00:00:00.000Z`), locale)} to {formatDate(new Date(`${to}T00:00:00.000Z`), locale)}</dd>
          <dt className="text-muted-foreground">Diaries</dt>
          <dd className="font-semibold" data-testid="report-count">{diaries.length} ({diaries.filter((d) => d.status === "LOCKED").length} countersigned)</dd>
          <dt className="text-muted-foreground">Worker-days</dt>
          <dd className="font-semibold">{manDays}</dd>
          <dt className="text-muted-foreground">Days with rain</dt>
          <dd className="font-semibold">{rainDays}</dd>
          <dt className="text-muted-foreground">Printed</dt>
          <dd className="font-semibold">{formatDateTime(new Date(), locale)}</dd>
        </dl>

        {rows.length === 0 ? <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No diaries in this period.</p> : null}
        {rows.map(({ d, manpower, machinery, materials }) => (
          <section key={d.id} className="mb-4 border-t pt-3 print:break-inside-avoid" aria-label={`Diary ${d.date.toISOString().slice(0, 10)}`}>
            <h3 className="font-bold">{formatDate(d.date, locale)} <span className="font-normal text-muted-foreground">· {d.weather} · {manpower} workers</span></h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{d.worksDone}</p>
            {d.issues ? <p className="mt-1 text-sm"><strong>Issues:</strong> {d.issues}</p> : null}
            {machinery.length ? <p className="mt-1 text-sm"><strong>Machinery:</strong> {machinery.join(", ")}</p> : null}
            {materials.length ? <p className="mt-1 text-sm"><strong>Delivered:</strong> {materials.map((m) => m.description).join(", ")}</p> : null}
            {d.visitorLog ? <p className="mt-1 text-sm"><strong>Visitors:</strong> {d.visitorLog}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">
              Prepared by {d.preparedBy}{d.verifiedBy ? `; countersigned by ${d.verifiedBy}` : "; not yet countersigned"}
            </p>
          </section>
        ))}
      </article>
    </div>
  );
}
