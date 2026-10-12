import { notFound } from "next/navigation";
import { requireFinancialsPage } from "@/lib/guards";
import { Letterhead } from "@/components/layout/letterhead";
import { PrintButton } from "@/components/print-button";
import { claimBalance } from "@/lib/claims";
import { COMPANY, PAYMENT_TERMS_DAYS, SIGNATORY } from "@/lib/company-config";
import { formatDate, formatRM, todayInMalaysia } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { daysOverdue } from "@/lib/receivables";

export const dynamic = "force-dynamic";

export default async function ReminderPage({ params }: { params: { claimId: string } }) {
  await requireFinancialsPage();
  const claim = await prisma.claim.findUnique({
    where: { id: params.claimId },
    include: { project: true, payments: true },
  });
  if (!claim) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const today = todayInMalaysia();
  const { balance, paid } = claimBalance(claim.netClaim, claim.payments);
  const overdue = daysOverdue(claim.date, today);
  const dueDate = new Date(claim.date.getTime() + PAYMENT_TERMS_DAYS * 24 * 60 * 60 * 1000);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="rounded-xl border border-border bg-card p-6 text-sm leading-relaxed print:rounded-none print:border-0 print:p-0">
        <Letterhead />
        <p className="mt-4">{formatDate(today, locale)}</p>
        <p className="mt-4 font-semibold">{claim.project.clientName ?? "The Accounts Department"}</p>
        <p className="mt-4 font-bold uppercase">
          Payment reminder: Progress Claim No. {claim.number}, {claim.project.name}
        </p>
        <p className="mt-4">Dear Sir/Madam,</p>
        <p className="mt-3">
          Thank you for the opportunity to work with you on {claim.project.name}. We are writing to gently remind you
          that Progress Claim No. {claim.number}, issued on {formatDate(claim.date, locale)}, still has a balance
          outstanding.
        </p>
        <dl className="my-4 divide-y divide-border border-y border-border">
          <Row label="Net claim" value={money(claim.netClaim.toNumber())} />
          {paid > 0 ? <Row label="Received so far" value={money(paid)} /> : null}
          <Row label="Balance outstanding" value={money(balance)} strong />
          <Row label="Payment was due" value={formatDate(dueDate, locale)} />
          {overdue > 0 ? <Row label="Days overdue" value={String(overdue)} /> : null}
        </dl>
        <p>
          We would be grateful if payment could be arranged at your earliest convenience. If you have already made this
          payment, please accept our thanks and disregard this letter. If there is any query on the claim, please contact
          us and we will be happy to help.
        </p>
        <p className="mt-6">Yours faithfully,</p>
        <p className="mt-10 font-semibold">{SIGNATORY.name}</p>
        <p>{SIGNATORY.title}</p>
        <p>{COMPANY.name}</p>
      </article>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${strong ? "font-bold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
