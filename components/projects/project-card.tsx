import Link from "next/link";
import { Card } from "@/components/ui/card";
import { formatRM } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/project-summary";
import { cn } from "@/lib/utils";

/** Phone layout: the same numbers as a table row, as a compact card. */
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
    <Link href={`/projects/${id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="p-3 transition-colors hover:border-primary/40">
        <h2 className="text-base font-semibold leading-snug">{name}</h2>
        {clientName ? <p className="text-sm text-muted-foreground">{clientName}</p> : null}
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
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
          className={cn("mt-3 rounded-md border px-2.5 py-1.5", inProfit ? "border-profit/20 bg-profit-light text-profit-dark" : "border-loss/20 bg-loss-light text-loss-dark")}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wide">Real {inProfit ? "Profit" : "Loss"}</span>
          <span className="font-mono text-lg font-semibold tabular-nums">{money(totals.realProfit)}</span>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[13px] font-medium tabular-nums">{value}</dd>
    </div>
  );
}
