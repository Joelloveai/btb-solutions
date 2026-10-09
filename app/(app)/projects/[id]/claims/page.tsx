import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteClaimButton } from "@/components/claims/claim-row-actions";
import { IssueClaimButton } from "@/components/claims/issue-claim-form";
import { EmptyState } from "@/components/ui/empty-state";
import { claimBalance } from "@/lib/claims";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClaimsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { claims: { orderBy: { number: "desc" }, include: { payments: true } }, changeOrders: true },
  });
  if (!project) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const sum = (values: Prisma.Decimal.Value[]) => values.reduce<Prisma.Decimal>((t, v) => t.plus(v), new Prisma.Decimal(0));

  const approved = sum(project.changeOrders.filter((c) => c.status === "APPROVED").map((c) => c.amount));
  const claimedWork = sum(project.claims.map((c) => c.workDone));
  const claimableLeft = project.contractValue.plus(approved).minus(claimedWork).toNumber();
  const previousClaimed = sum(project.claims.map((c) => c.amountClaimed)).toNumber();

  return (
    <>
      <Link href={`/projects/${project.id}`} className="text-sm font-medium text-brand">
        ← {project.name}
      </Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Progress Claims</h1>
        <IssueClaimButton
          projectId={project.id}
          retentionPercent={project.retentionPercent.toNumber()}
          sstEnabled={project.sstEnabled}
          sstRate={project.sstRate.toNumber()}
          previousClaimed={previousClaimed}
          claimableLeft={Math.max(0, claimableLeft)}
        />
      </div>
      <p className="mb-4 text-sm text-slate-600">
        Worked on so far: {money(claimedWork.toNumber())} of {money(project.contractValue.plus(approved).toNumber())} · Retention{" "}
        {project.retentionPercent.toNumber()}%
      </p>

      {project.claims.length === 0 ? (
        <EmptyState title="No claims yet" hint="Issue your first progress claim when work is ready to be billed." />
      ) : (
        <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Claim</th>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 text-right font-semibold">Work Done</th>
                <th className="px-3 py-2.5 text-right font-semibold">Retention</th>
                <th className="px-3 py-2.5 text-right font-semibold">Net Claim</th>
                <th className="px-3 py-2.5 text-right font-semibold">Balance</th>
                <th className="w-32 px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.claims.map((c) => {
                const { balance } = claimBalance(c.netClaim, c.payments);
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-3 font-semibold">No. {c.number}</td>
                    <td className="px-3 py-3">{formatDate(c.date, locale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(c.workDone.toNumber())}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(c.retentionAmount.toNumber())}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(c.netClaim.toNumber())}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${balance > 0 ? "text-pending-dark" : "text-profit-dark"}`}>
                      {balance > 0 ? money(balance) : "Paid"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/projects/${project.id}/claims/${c.id}`}
                          target="_blank"
                          className="rounded-lg px-2 py-2 text-sm font-semibold text-brand hover:bg-slate-100"
                        >
                          Print
                        </Link>
                        {c.number === project.lastClaimNumber && c.payments.length === 0 ? (
                          <DeleteClaimButton id={c.id} number={c.number} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
