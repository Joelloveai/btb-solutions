"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { formatRM } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { ProjectSummary } from "@/lib/project-summary";
import { cn } from "@/lib/utils";

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

/** CEO view: one compact row per project. Sortable; best earner first by default. */
export function ProjectTable({ rows, locale }: { rows: ProjectRow[]; locale: Locale }) {
  const money = (value: number) => formatRM(value, locale);
  const moneyColumn = (id: string, header: string, pick: (r: ProjectRow) => number, className?: string): ColumnDef<ProjectRow> => ({
    id,
    header,
    accessorFn: pick,
    meta: { numeric: true },
    cell: ({ getValue }) => <span className={className}>{money(getValue<number>())}</span>,
  });

  const columns: ColumnDef<ProjectRow>[] = [
    {
      id: "project",
      header: "Project",
      accessorFn: (r) => r.name.toLowerCase(),
      meta: { className: "max-w-[20rem]" },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <Link href={`/projects/${r.id}`} className="block truncate font-semibold text-foreground hover:text-accent hover:underline">
              {r.name}
            </Link>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate">{r.clientName ?? "No client"}</span>
              <Badge tone={statusTone[r.status as ProjectStatus] ?? "gray"}>{PROJECT_STATUS_LABELS[r.status as ProjectStatus] ?? r.status}</Badge>
            </span>
          </div>
        );
      },
    },
    {
      id: "contract",
      header: "Contract Value",
      accessorFn: (r) => r.contractValue,
      meta: { numeric: true },
      cell: ({ row }) => (
        <>
          {money(row.original.contractValue)}
          {row.original.sstEnabled ? <span className="block font-sans text-xs text-muted-foreground">incl. SST</span> : null}
        </>
      ),
    },
    moneyColumn("claims", "Claims Issued", (r) => r.summary.claimsIssued),
    moneyColumn("cash", "Cash Received", (r) => r.summary.totalPayments),
    moneyColumn("costs", "Costs to Date", (r) => r.summary.totalCosts),
    {
      id: "subcon",
      header: "Subcon Owed",
      accessorFn: (r) => r.summary.subconOwed,
      meta: { numeric: true },
      cell: ({ getValue }) => <span className={cn(getValue<number>() > 0 && "text-pending")}>{money(getValue<number>())}</span>,
    },
    moneyColumn("retention", "Retention Held", (r) => r.summary.retentionHeld),
    {
      id: "profit",
      header: "Real Profit",
      accessorFn: (r) => r.summary.realProfit,
      meta: { numeric: true },
      cell: ({ getValue }) => (
        <span data-testid="row-profit-loss" className={cn("font-semibold", getValue<number>() >= 0 ? "text-profit" : "text-loss")}>
          {money(getValue<number>())}
        </span>
      ),
    },
  ];

  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "profit", desc: true }]} />;
}
