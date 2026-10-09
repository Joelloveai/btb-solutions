"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

export type QuoteRow = {
  id: string;
  number: string;
  title: string;
  clientName: string;
  dateText: string;
  dateSort: number;
  status: string;
  statusLabel: string;
  total: string;
  totalValue: number;
};

const tone = { DRAFT: "gray", SENT: "blue", ACCEPTED: "green", REJECTED: "red" } as const;

export function QuotesTable({ rows }: { rows: QuoteRow[] }) {
  const columns: ColumnDef<QuoteRow>[] = [
    {
      id: "quote",
      header: "Quote",
      accessorFn: (r) => r.number,
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link href={`/quotes/${row.original.id}`} className="font-semibold text-foreground hover:text-accent hover:underline">
            {row.original.number} · {row.original.title}
          </Link>
          <span className="block truncate text-xs text-muted-foreground md:hidden">
            {row.original.clientName} · {row.original.dateText}
          </span>
        </div>
      ),
    },
    { id: "client", header: "Client", accessorFn: (r) => r.clientName, meta: { className: "hidden md:table-cell" }, cell: ({ getValue }) => getValue<string>() },
    { id: "date", header: "Date", accessorFn: (r) => r.dateSort, meta: { className: "hidden md:table-cell" }, cell: ({ row }) => row.original.dateText },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.status,
      cell: ({ row }) => <Badge tone={tone[row.original.status as keyof typeof tone] ?? "gray"}>{row.original.statusLabel}</Badge>,
    },
    { id: "total", header: "Total", accessorFn: (r) => r.totalValue, meta: { numeric: true }, cell: ({ row }) => row.original.total },
  ];
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "quote", desc: true }]} />;
}
