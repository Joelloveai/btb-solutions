import clsx from "clsx";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { formatRM } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/project-summary";

export type ProjectRow = {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  sstEnabled: boolean;
  contractValue: number;
  summary: ProjectSummary;
};

export const statusTone = { ACTIVE: "blue", COMPLETED: "gray", ON_HOLD: "yellow", CANCELLED: "gray" } as const;

const th = "px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500";
const num = "whitespace-nowrap px-3 py-2 text-right tabular-nums";

/** CEO view: one compact row per project, best earner first, so the bleeders sit at the bottom. */
export function ProjectTable({ rows, locale }: { rows: ProjectRow[]; locale: Locale }) {
  const money = (value: number) => formatRM(value, locale);
  return (
    <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Project</th>
            <th className={th}>Contract Value</th>
            <th className={th}>Claims Issued</th>
            <th className={th}>Cash Received</th>
            <th className={th}>Costs to Date</th>
            <th className={th}>Subcon Owed</th>
            <th className={th}>Retention Held</th>
            <th className={th}>Real Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ id, name, clientName, status, sstEnabled, contractValue, summary }) => {
            const inProfit = summary.realProfit >= 0;
            return (
              <tr key={id} className="hover:bg-slate-50">
                <td className="max-w-[18rem] px-3 py-2">
                  <Link href={`/projects/${id}`} className="block truncate font-semibold text-brand hover:underline">
                    {name}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="truncate">{clientName ?? "No client"}</span>
                    <Badge tone={statusTone[status as ProjectStatus] ?? "gray"}>
                      {PROJECT_STATUS_LABELS[status as ProjectStatus] ?? status}
                    </Badge>
                  </span>
                </td>
                <td className={num}>
                  {money(contractValue)}
                  {sstEnabled ? <span className="block text-xs text-slate-500">incl. SST</span> : null}
                </td>
                <td className={num}>{money(summary.claimsIssued)}</td>
                <td className={num}>{money(summary.totalPayments)}</td>
                <td className={num}>{money(summary.totalCosts)}</td>
                <td className={clsx(num, summary.subconOwed > 0 && "text-pending-dark")}>{money(summary.subconOwed)}</td>
                <td className={num}>{money(summary.retentionHeld)}</td>
                <td data-testid="row-profit-loss" className={clsx(num, "font-bold", inProfit ? "text-profit" : "text-loss")}>
                  {money(summary.realProfit)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
