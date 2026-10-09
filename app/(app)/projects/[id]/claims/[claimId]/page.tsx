import { notFound } from "next/navigation";
import { Letterhead } from "@/components/layout/letterhead";
import { PrintButton } from "@/components/print-button";
import { claimBalance } from "@/lib/claims";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClaimPrintPage({ params }: { params: { id: string; claimId: string } }) {
  const claim = await prisma.claim.findUnique({
    where: { id: params.claimId },
    include: { project: true, payments: true },
  });
  if (!claim || claim.projectId !== params.id) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const { project } = claim;
  const { paid } = claimBalance(claim.netClaim, claim.payments);

  const rows: [string, string, boolean?][] = [
    ["Work Done This Period", money(claim.workDone.toNumber())],
    ...(claim.sstAmount.greaterThan(0)
      ? ([[`SST (${project.sstRate.toNumber()}%)`, money(claim.sstAmount.toNumber())]] as [string, string][])
      : []),
    ["Amount Claimed", money(claim.amountClaimed.toNumber())],
    [`Less: Retention Held (${claim.retentionPercent.toNumber()}%)`, `-${money(claim.retentionAmount.toNumber())}`],
    ["Net Claim", money(claim.netClaim.toNumber()), true],
    ["Previous Claims (total claimed before this)", money(claim.previousClaimed.toNumber())],
    ...(paid > 0 ? ([["Paid against this claim", money(paid)]] as [string, string][]) : []),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="rounded-xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <Letterhead />
        <h2 className="my-4 text-lg font-bold uppercase tracking-wide">Progress Claim No. {claim.number}</h2>
        <dl className="mb-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-600">Project</dt><dd className="font-semibold">{project.name}</dd>
          <dt className="text-slate-600">Client</dt><dd className="font-semibold">{project.clientName ?? "—"}</dd>
          <dt className="text-slate-600">Claim No.</dt><dd className="font-semibold">{claim.number}</dd>
          <dt className="text-slate-600">Claim Date</dt><dd className="font-semibold">{formatDate(claim.date, locale)}</dd>
        </dl>
        <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
          {rows.map(([label, value, strong]) => (
            <div key={label} className={`flex justify-between gap-4 py-2.5 ${strong ? "font-bold" : ""}`}>
              <dt className={strong ? "" : "text-slate-600"}>{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
}
