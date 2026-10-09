"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DeleteClaimButton } from "@/components/claims/claim-row-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

export type ClaimRow = {
  id: string;
  projectId: string;
  number: number;
  dateText: string;
  dateSort: number;
  workDone: string;
  retention: string;
  netClaim: string;
  netClaimValue: number;
  balance: string;
  balanceValue: number;
  paidAny: boolean;
  canDelete: boolean;
};

const statusOf = (r: ClaimRow) => (r.balanceValue <= 0 ? ("Paid" as const) : r.paidAny ? ("Part paid" as const) : ("Unpaid" as const));
const statusTone = { Paid: "green", "Part paid": "yellow", Unpaid: "gray" } as const;

/** Claims for one project. On phones the date and balance fold under the first two columns. */
export function ClaimsTable({ rows }: { rows: ClaimRow[] }) {
  const columns: ColumnDef<ClaimRow>[] = [
    {
      id: "claim",
      header: "Claim",
      accessorFn: (r) => r.number,
      cell: ({ row }) => (
        <div>
          <span className="font-semibold">No. {row.original.number}</span>
          <span className="block text-xs text-muted-foreground md:hidden">{row.original.dateText}</span>
          <span className="mt-1 block">
            <Badge tone={statusTone[statusOf(row.original)]}>{statusOf(row.original)}</Badge>
          </span>
        </div>
      ),
    },
    {
      id: "date",
      header: "Date",
      accessorFn: (r) => r.dateSort,
      meta: { className: "hidden md:table-cell" },
      cell: ({ row }) => row.original.dateText,
    },
    { id: "work", header: "Work Done", accessorFn: (r) => r.workDone, enableSorting: false, meta: { numeric: true, className: "hidden md:table-cell" }, cell: ({ getValue }) => getValue<string>() },
    { id: "retention", header: "Retention", accessorFn: (r) => r.retention, enableSorting: false, meta: { numeric: true, className: "hidden md:table-cell" }, cell: ({ getValue }) => getValue<string>() },
    {
      id: "net",
      header: "Net Claim",
      accessorFn: (r) => r.netClaimValue,
      meta: { numeric: true },
      cell: ({ row }) => (
        <>
          <span className="font-semibold">{row.original.netClaim}</span>
          <span className={cn("block text-xs md:hidden", row.original.balanceValue > 0 ? "text-pending" : "text-profit")}>
            {row.original.balanceValue > 0 ? `Due ${row.original.balance}` : "Paid"}
          </span>
        </>
      ),
    },
    {
      id: "balance",
      header: "Balance",
      accessorFn: (r) => r.balanceValue,
      meta: { numeric: true, className: "hidden md:table-cell" },
      cell: ({ row }) => (
        <span className={row.original.balanceValue > 0 ? "text-pending" : "text-profit"}>
          {row.original.balanceValue > 0 ? row.original.balance : "Paid"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/projects/${row.original.projectId}/claims/${row.original.id}`}
            target="_blank"
            className="rounded-md px-2 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Print
          </Link>
          {row.original.canDelete ? <DeleteClaimButton id={row.original.id} number={row.original.number} /> : null}
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "claim", desc: true }]} />;
}
