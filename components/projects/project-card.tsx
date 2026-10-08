import Link from "next/link";
import clsx from "clsx";
import { formatRM } from "@/lib/format";
import type { ProjectTotals } from "@/lib/calculations";

export function ProjectCard({
  id,
  name,
  clientName,
  contractValue,
  totals,
}: {
  id: string;
  name: string;
  clientName: string | null;
  contractValue: number;
  totals: ProjectTotals;
}) {
  const inProfit = totals.profitLoss >= 0;
  return (
    <Link
      href={`/projects/${id}`}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand"
    >
      <h2 className="text-lg font-bold">{name}</h2>
      {clientName ? <p className="text-sm text-gray-600">{clientName}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Contract Value" value={formatRM(contractValue)} />
        <Stat label="Total Costs" value={formatRM(totals.totalCosts)} />
        <Stat label="Payments Received" value={formatRM(totals.totalPayments)} />
        <Stat label="Outstanding Balance" value={formatRM(totals.outstandingBalance)} />
      </dl>
      <div
        data-testid="profit-loss"
        className={clsx(
          "mt-3 rounded-lg px-3 py-2",
          inProfit ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800",
        )}
      >
        <span className="block text-xs font-medium uppercase tracking-wide">
          Current {inProfit ? "Profit" : "Loss"}
        </span>
        <span className="text-xl font-bold">{formatRM(totals.profitLoss)}</span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
