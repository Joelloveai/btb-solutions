"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { linkButton } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

export type ReceivableRow = {
  claimId: string;
  projectId: string;
  client: string;
  project: string;
  claimNumber: number;
  balance: string;
  balanceValue: number;
  issuedText: string;
  issuedSort: number;
  days: number;
  bucket: "current" | "late" | "overdue" | "critical";
  status: string;
};

// Aging bands: 0-30 green, 31-60 amber, 61-90 orange, 90+ red.
const bucketTone = { current: "green", late: "yellow", overdue: "orange", critical: "red" } as const;

export function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  const columns: ColumnDef<ReceivableRow>[] = [
    { id: "client", header: "Client", accessorFn: (r) => r.client, cell: ({ getValue }) => <span className="font-semibold">{getValue<string>()}</span> },
    {
      id: "project",
      header: "Project",
      accessorFn: (r) => r.project,
      cell: ({ row }) => (
        <Link href={`/projects/${row.original.projectId}`} className="text-foreground hover:text-accent hover:underline">
          {row.original.project}
        </Link>
      ),
    },
    { id: "claim", header: "Claim No.", accessorFn: (r) => r.claimNumber, cell: ({ getValue }) => getValue<number>() },
    { id: "amount", header: "Amount", accessorFn: (r) => r.balanceValue, meta: { numeric: true }, cell: ({ row }) => row.original.balance },
    { id: "issued", header: "Date Issued", accessorFn: (r) => r.issuedSort, cell: ({ row }) => row.original.issuedText },
    {
      id: "days",
      header: "Days Overdue",
      accessorFn: (r) => r.days,
      cell: ({ row }) => (
        <span data-testid="days-overdue">
          <Badge tone={bucketTone[row.original.bucket]}>{String(row.original.days)}</Badge>
        </span>
      ),
    },
    { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ getValue }) => getValue<string>() },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Link href={`/receivables/${row.original.claimId}/reminder`} target="_blank" className={linkButton("accent", true)}>
          Generate Reminder
        </Link>
      ),
    },
  ];
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "days", desc: true }]} />;
}
