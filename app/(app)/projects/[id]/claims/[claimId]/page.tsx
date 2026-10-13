import { notFound } from "next/navigation";
import { requireFinancialsPage } from "@/lib/guards";
import { Letterhead } from "@/components/layout/letterhead";
import { ClaimActions } from "@/components/claims/claim-actions";
import { PrintButton } from "@/components/print-button";
import { cipaaCountdown, cipaaStage, daysSince } from "@/lib/cipaa";
import { claimBalance } from "@/lib/claims";
import { formatDate, formatRM, todayInMalaysia } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClaimPrintPage({ params }: { params: { id: string; claimId: string } }) {
  await requireFinancialsPage();
  const claim = await prisma.claim.findUnique({
    where: { id: params.claimId },
    include: { project: true, payments: true, lineItems: true, certificates: { orderBy: { certifiedAt: "desc" } } },
  });
  if (!claim || claim.projectId !== params.id) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const { project } = claim;
  const { paid, balance } = claimBalance(claim.netClaim, claim.payments);
  const days = daysSince(claim.date, todayInMalaysia());
  const unpaid = balance > 0;

  const rows: [string, string, boolean?][] = [
    ["Work Done This Period", money(claim.workDone.toNumber())],
    ...(claim.sstAmount.greaterThan(0)
      ? ([[`SST (${project.sstRate.toNumber()}%)`, money(claim.sstAmount.toNumber())]] as [string, string][])
      : []),
    ["Amount Claimed", money(claim.amountClaimed.toNumber())],
    [`Less: Retention Held (${claim.retentionPercent.toNumber()}%)`, `-${money(claim.retentionAmount.toNumber())}`],
    ["Net Claim", money(claim.netClaim.toNumber()), true],
    ["Previous Claims (total claimed before this)", money(claim.previousClaimed.toNumber())],
    ...(claim.materialsOnSiteAmount.greaterThan(0) ? ([["Includes materials on site", money(claim.materialsOnSiteAmount.toNumber())]] as [string, string][]) : []),
    ...(paid > 0 ? ([["Paid against this claim", money(paid)]] as [string, string][]) : []),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <ClaimActions
        claimId={claim.id}
        netClaim={claim.netClaim.toFixed(2)}
        status={claim.status}
        unpaid={unpaid}
        countdown={unpaid ? `${claim.claimNumber ?? `Claim ${claim.number}`}: ${days} days since the claim date. ${cipaaCountdown(days, true)}.` : "This claim is paid."}
        canPaymentResponse={unpaid && cipaaStage(days, true) !== "WITHIN_TERMS"}
        canAdjudication={unpaid && cipaaStage(days, true) === "ADJUDICATION"}
        hasCertificate={claim.certificates.length > 0}
      />
      <article className="rounded-xl border border-border bg-card p-6 print:rounded-none print:border-0 print:p-0">
        <Letterhead />
        <h2 className="my-4 text-lg font-bold uppercase tracking-wide">Progress Claim No. {claim.number}</h2>
        <dl className="mb-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Project</dt><dd className="font-semibold">{project.name}</dd>
          <dt className="text-muted-foreground">Client</dt><dd className="font-semibold">{project.clientName ?? "—"}</dd>
          <dt className="text-muted-foreground">Claim No.</dt><dd className="font-semibold" data-testid="claim-number">{claim.claimNumber ?? claim.number}</dd>
          {claim.periodFrom && claim.periodTo ? (
            <>
              <dt className="text-muted-foreground">Period</dt><dd className="font-semibold">{formatDate(claim.periodFrom, locale)} to {formatDate(claim.periodTo, locale)}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Status</dt><dd className="font-semibold" data-testid="claim-status">{unpaid ? claim.status.charAt(0) + claim.status.slice(1).toLowerCase() : "Paid"}</dd>
          <dt className="text-muted-foreground">Claim Date</dt><dd className="font-semibold">{formatDate(claim.date, locale)}</dd>
        </dl>
        <dl className="divide-y divide-border border-y border-border text-sm">
          {rows.map(([label, value, strong]) => (
            <div key={label} className={`flex justify-between gap-4 py-2.5 ${strong ? "font-bold" : ""}`}>
              <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {claim.lineItems.length > 0 ? (
          <table className="mt-5 w-full text-left text-xs" data-testid="claim-lines">
            <caption className="mb-1 text-left text-sm font-semibold">Work claimed this period, by BOQ item</caption>
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Rate</th>
                <th className="py-1 text-right">This claim</th>
              </tr>
            </thead>
            <tbody>
              {claim.lineItems.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-1">{l.description}</td>
                  <td className="py-1 text-right">{l.quantity.toString()} {l.unit}</td>
                  <td className="py-1 text-right">{money(l.rate.toNumber())}</td>
                  <td className="py-1 text-right font-semibold">{money(l.currentAmount.toNumber())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {claim.certificates[0] ? (
          <p className="mt-5 text-sm" data-testid="claim-certificate">
            Certified {money(claim.certificates[0].certifiedAmount.toNumber())} by {claim.certificates[0].certifiedBy} on {formatDate(claim.certificates[0].certifiedAt, locale)} (certificate {claim.certificates[0].certificateNumber}).
          </p>
        ) : null}
      </article>
    </div>
  );
}
