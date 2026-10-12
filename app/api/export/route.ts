import { getServerSession } from "next-auth";
import { can } from "@/lib/permissions";
import { authOptions, roleOf } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HEADERS = [
  "Record Type",
  "Project",
  "Client",
  "Project Status",
  "Start Date",
  "Contract Value (RM)",
  "SST Enabled",
  "SST Rate (%)",
  "Date",
  "Category",
  "Description",
  "Amount (RM)",
  "Vendor",
  "Reference",
  "Change Order Status",
];

/** Quotes a cell, and defuses text that a spreadsheet would run as a formula. */
function text(value: string | null | undefined): string {
  if (!value) return "";
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const day = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

export async function GET() {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });
  if (!can(session?.user?.staffRole, "financials.view")) return new Response("Not allowed", { status: 403 });

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      costs: { orderBy: { date: "asc" } },
      payments: { orderBy: { date: "asc" } },
      changeOrders: { orderBy: { date: "asc" } },
    },
  });

  const rows: string[][] = [];
  for (const p of projects) {
    const base = [text(p.name), text(p.clientName), p.status, day(p.startDate)];
    const withProject = (type: string, contract: string, sst: string, rate: string, rest: string[]) =>
      rows.push([type, ...base, contract, sst, rate, ...rest]);

    withProject("PROJECT", p.contractValue.toFixed(2), p.sstEnabled ? "Yes" : "No", p.sstRate.toFixed(2), [
      "", "", "", "", "", "", "",
    ]);
    for (const c of p.costs) {
      withProject("COST", "", "", "", [
        day(c.date), c.category, text(c.description), c.amount.toFixed(2), text(c.vendor), text(c.reference), "",
      ]);
    }
    for (const pay of p.payments) {
      withProject("PAYMENT", "", "", "", [day(pay.date), "", "", pay.amount.toFixed(2), "", text(pay.reference), ""]);
    }
    for (const co of p.changeOrders) {
      withProject("CHANGE_ORDER", "", "", "", [
        day(co.date), "", text(co.description), co.amount.toFixed(2), "", "", co.status,
      ]);
    }
  }

  // The byte-order mark makes Excel read the file as UTF-8.
  const csv = "﻿" + [HEADERS.join(","), ...rows.map((r) => r.join(","))].join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="btb-jobcost-backup-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
