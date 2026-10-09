"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";

export type ClientRow = {
  key: string;
  name: string;
  projects: number;
  revenue: string;
  revenueValue: number;
  avgDays: number | null;
  lastText: string;
  lastSort: number;
};

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  const columns: ColumnDef<ClientRow>[] = [
    { id: "client", header: "Client", accessorFn: (r) => r.name, cell: ({ getValue }) => <span className="font-semibold">{getValue<string>()}</span> },
    { id: "projects", header: "Projects", accessorFn: (r) => r.projects, meta: { numeric: true }, cell: ({ getValue }) => getValue<number>() },
    { id: "revenue", header: "Total Revenue", accessorFn: (r) => r.revenueValue, meta: { numeric: true }, cell: ({ row }) => row.original.revenue },
    { id: "avg", header: "Avg Days to Pay", accessorFn: (r) => r.avgDays ?? -1, meta: { numeric: true }, cell: ({ row }) => row.original.avgDays ?? "—" },
    { id: "last", header: "Last Project", accessorFn: (r) => r.lastSort, cell: ({ row }) => row.original.lastText },
  ];
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "revenue", desc: true }]} />;
}
