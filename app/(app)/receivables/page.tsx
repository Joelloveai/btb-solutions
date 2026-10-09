import clsx from "clsx";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { claimBalance } from "@/lib/claims";
import { PAYMENT_TERMS_DAYS } from "@/lib/company-config";
import { formatDate, formatRM, todayInMalaysia } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { summarizeProject } from "@/lib/project-summary";
import { ageBucket, BUCKET_STYLES, daysOverdue } from "@/lib/receivables";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  const { locale, t } = await getT();
  const money = (n: number) => formatRM(n, locale);
  const today = todayInMalaysia();

  const claims = await prisma.claim.findMany({
    include: { project: true, payments: true },
  });
  const open = claims
    .map((c) => {
      const { balance, paid } = claimBalance(c.netClaim, c.payments);
      const days = daysOverdue(c.date, today);
      return { claim: c, balance, paid, days };
    })
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.days - a.days || a.claim.date.getTime() - b.claim.date.getTime());
  const totalOwed = open.reduce((t0, r) => t0 + r.balance, 0);

  const projects = await prisma.project.findMany({
    include: { costs: true, payments: true, changeOrders: true, claims: true },
  });
  const retention = projects
    .map((p) => ({ project: p, summary: summarizeProject(p) }))
    .filter((r) => r.summary.retentionOutstanding > 0);

  const status = (r: (typeof open)[number]) => (r.paid > 0 ? "Partly paid" : r.days > 0 ? "Overdue" : "Unpaid");
  const bucketClass = (days: number) => BUCKET_STYLES[ageBucket(days)];

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">{t.receivables}</h1>
      <p className="mb-5 text-sm text-slate-600">
        Claims are due {PAYMENT_TERMS_DAYS} days after the claim date. Total waiting to be collected:{" "}
        <span className="font-semibold text-slate-900" data-testid="total-owed">{money(totalOwed)}</span>
      </p>

      {open.length === 0 ? (
        <EmptyState title="Nothing outstanding" hint="Every issued claim has been paid." />
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {open.map((r) => (
              <div key={r.claim.id} className="rounded-xl border border-slate-200 bg-white p-[0.6rem]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.claim.project.clientName ?? "No client"}</p>
                    <p className="truncate text-sm text-slate-600">
                      {r.claim.project.name} · Claim {r.claim.number}
                    </p>
                  </div>
                  <span className={clsx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", bucketClass(r.days))}>
                    {r.days} days
                  </span>
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums">{money(r.balance)}</p>
                <p className="text-sm text-slate-600">
                  {status(r)} · issued {formatDate(r.claim.date, locale)}
                </p>
                <Link
                  href={`/receivables/${r.claim.id}/reminder`}
                  target="_blank"
                  className="mt-2 inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white"
                >
                  Generate Reminder
                </Link>
              </div>
            ))}
          </div>

          <div className="relative hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 font-semibold">Project</th>
                  <th className="px-3 py-2 font-semibold">Claim No.</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Date Issued</th>
                  <th className="px-3 py-2 font-semibold">Days Overdue</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {open.map((r) => (
                  <tr key={r.claim.id}>
                    <td className="px-3 py-2 font-semibold">{r.claim.project.clientName ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link href={`/projects/${r.claim.projectId}`} className="text-brand hover:underline">
                        {r.claim.project.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.claim.number}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.balance)}</td>
                    <td className="px-3 py-2">{formatDate(r.claim.date, locale)}</td>
                    <td className="px-3 py-2">
                      <span data-testid="days-overdue" className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", bucketClass(r.days))}>
                        {r.days}
                      </span>
                    </td>
                    <td className="px-3 py-2">{status(r)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/receivables/${r.claim.id}/reminder`}
                        target="_blank"
                        className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-semibold text-white"
                      >
                        Generate Reminder
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {retention.length > 0 ? (
        <section className="mt-8" aria-label="Retention outstanding">
          <h2 className="mb-2 text-lg font-bold">Retention to collect</h2>
          <div className="space-y-2">
            {retention.map(({ project, summary }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 hover:border-brand"
              >
                <div>
                  <p className="font-semibold">{project.name}</p>
                  <p className="text-sm text-slate-600">{project.clientName ?? "No client"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{money(summary.retentionOutstanding)}</span>
                  <Badge tone={project.status === "COMPLETED" ? "yellow" : "gray"}>
                    {project.status === "COMPLETED" ? "Ready to release" : "Held until completion"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
