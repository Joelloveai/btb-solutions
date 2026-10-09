import { EmptyState } from "@/components/ui/empty-state";
import { claimBalance } from "@/lib/claims";
import { formatDate, formatRM } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { summarizeProject } from "@/lib/project-summary";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function ClientsPage() {
  const { locale, t } = await getT();
  const money = (n: number) => formatRM(n, locale);
  const projects = await prisma.project.findMany({
    include: { costs: true, payments: true, changeOrders: true, claims: { include: { payments: true } } },
  });

  // Clients are the free-text client name on each project; there is no separate client record.
  const byClient = new Map<string, typeof projects>();
  for (const p of projects) {
    const key = p.clientName?.trim() || "No client set";
    byClient.set(key, [...(byClient.get(key) ?? []), p]);
  }

  const rows = [...byClient.entries()].map(([name, list]) => {
    const revenue = list.reduce((t0, p) => t0 + summarizeProject(p).revisedContractValue, 0);
    // A claim counts as paid once its payments cover the net claim; days run from the claim date to the last payment.
    const paidDays: number[] = [];
    for (const p of list) {
      for (const c of p.claims) {
        if (c.payments.length === 0 || claimBalance(c.netClaim, c.payments).balance > 0) continue;
        const last = Math.max(...c.payments.map((x) => x.date.getTime()));
        paidDays.push(Math.max(0, Math.round((last - c.date.getTime()) / DAY)));
      }
    }
    const lastProject = Math.max(...list.map((p) => (p.startDate ?? p.createdAt).getTime()));
    return {
      name,
      projects: list.length,
      revenue,
      avgDays: paidDays.length ? Math.round(paidDays.reduce((a, b) => a + b, 0) / paidDays.length) : null,
      lastProject: new Date(lastProject),
    };
  });
  rows.sort((a, b) => b.revenue - a.revenue);

  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">{t.clients}</h1>
      {rows.length === 0 ? (
        <EmptyState title="No clients yet" hint="Clients appear here once you have projects." />
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <div key={r.name} className="rounded-xl border border-slate-200 bg-white p-[0.6rem]">
                <p className="font-semibold">{r.name}</p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-slate-500">Projects</dt><dd className="font-semibold">{r.projects}</dd></div>
                  <div><dt className="text-slate-500">Total revenue</dt><dd className="font-semibold">{money(r.revenue)}</dd></div>
                  <div><dt className="text-slate-500">Avg days to pay</dt><dd className="font-semibold">{r.avgDays ?? "—"}</dd></div>
                  <div><dt className="text-slate-500">Last project</dt><dd className="font-semibold">{formatDate(r.lastProject, locale)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
          <div className="relative hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 text-right font-semibold">Projects</th>
                  <th className="px-3 py-2 text-right font-semibold">Total Revenue</th>
                  <th className="px-3 py-2 text-right font-semibold">Avg Days to Pay</th>
                  <th className="px-3 py-2 font-semibold">Last Project</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.name}>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.projects}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.revenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.avgDays ?? "—"}</td>
                    <td className="px-3 py-2">{formatDate(r.lastProject, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
