import Link from "next/link";
import clsx from "clsx";
import { formatRM } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/project-summary";

/** Phone layout: the same numbers as a table row, with padding trimmed ~40% from the old card. */
export function ProjectCard({
  id,
  name,
  clientName,
  contractValue,
  totals,
  locale,
}: {
  id: string;
  name: string;
  clientName: string | null;
  contractValue: number;
  totals: ProjectSummary;
  locale: Locale;
}) {
  const inProfit = totals.realProfit >= 0;
  const money = (value: number) => formatRM(value, locale);
  return (
    <Link
      href={`/projects/${id}`}
      className="block rounded-xl border border-slate-200 bg-white p-[0.6rem] shadow-sm transition hover:border-brand"
    >
      <h2 className="text-base font-bold">{name}</h2>
      {clientName ? <p className="text-sm text-slate-600">{clientName}</p> : null}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Contract Value" value={money(contractValue)} />
        <Stat label="Claims Issued" value={money(totals.claimsIssued)} />
        <Stat label="Total Costs" value={money(totals.totalCosts)} />
        <Stat label="Payments Received" value={money(totals.totalPayments)} />
        <Stat label="Subcon Owed" value={money(totals.subconOwed)} />
        <Stat label="Retention Held" value={money(totals.retentionHeld)} />
        <Stat label="Outstanding Balance" value={money(totals.outstandingBalance)} />
      </dl>
      <div
        data-testid="profit-loss"
        className={clsx(
          "mt-2 rounded-lg px-2 py-1.5",
          inProfit ? "bg-profit-light text-profit-dark" : "bg-loss-light text-loss-dark",
        )}
      >
        <span className="block text-xs font-medium uppercase tracking-wide">Real {inProfit ? "Profit" : "Loss"}</span>
        <span className="text-lg font-bold">{money(totals.realProfit)}</span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
