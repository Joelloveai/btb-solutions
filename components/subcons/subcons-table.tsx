"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export type SubconRow = {
  id: string;
  name: string;
  trade: string | null;
  agreed: string;
  agreedValue: number;
  paid: string;
  paidValue: number;
  balance: string;
  balanceValue: number;
};

export function SubconsTable({ rows }: { rows: SubconRow[] }) {
  const columns: ColumnDef<SubconRow>[] = [
    {
      id: "name",
      header: "Subcontractor",
      accessorFn: (r) => r.name,
      cell: ({ row }) => (
        <Link href={`/subcons/${row.original.id}`} className="font-semibold text-foreground hover:text-accent hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { id: "trade", header: "Trade", accessorFn: (r) => r.trade ?? "", cell: ({ row }) => row.original.trade ?? "—" },
    { id: "agreed", header: "Total Agreed", accessorFn: (r) => r.agreedValue, meta: { numeric: true }, cell: ({ row }) => row.original.agreed },
    { id: "paid", header: "Total Paid", accessorFn: (r) => r.paidValue, meta: { numeric: true }, cell: ({ row }) => row.original.paid },
    {
      id: "balance",
      header: "Balance Owed",
      accessorFn: (r) => r.balanceValue,
      meta: { numeric: true },
      cell: ({ row }) => (
        <span className={row.original.balanceValue > 0 ? "font-semibold text-pending" : "text-muted-foreground"}>{row.original.balance}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => (r.balanceValue > 0 ? 1 : 0),
      cell: ({ row }) => <Badge tone={row.original.balanceValue > 0 ? "yellow" : "green"}>{row.original.balanceValue > 0 ? "Owed" : "Settled"}</Badge>,
    },
  ];
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "balance", desc: true }]} />;
}
