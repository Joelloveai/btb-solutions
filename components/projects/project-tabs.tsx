"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setChangeOrderStatus } from "@/app/actions";
import { AddChangeOrderForm } from "@/components/forms/add-change-order-form";
import { AddCostForm } from "@/components/forms/add-cost-form";
import { AddPaymentForm } from "@/components/forms/add-payment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CATEGORY_LABELS,
  CHANGE_ORDER_LABELS,
  type ChangeOrderStatus,
  type CostCategory,
} from "@/lib/constants";
import { formatDate, formatRM } from "@/lib/format";

export type CostRow = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
};
export type PaymentRow = { id: string; date: string; amount: number; reference: string | null };
export type ChangeOrderRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
};

const TABS = [
  { id: "costs", label: "Cost Entries" },
  { id: "payments", label: "Payments" },
  { id: "changes", label: "Change Orders" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const tone = { PENDING: "yellow", APPROVED: "green", REJECTED: "red" } as const;

export function ProjectTabs({
  projectId,
  costs,
  payments,
  changeOrders,
}: {
  projectId: string;
  costs: CostRow[];
  payments: PaymentRow[];
  changeOrders: ChangeOrderRow[];
}) {
  const [tab, setTab] = useState<TabId>("costs");

  return (
    <section>
      <div role="tablist" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-200 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              "h-11 rounded-lg text-sm font-semibold",
              tab === t.id ? "bg-white text-brand shadow" : "text-gray-600",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "costs" ? <CostsPanel projectId={projectId} rows={costs} /> : null}
        {tab === "payments" ? <PaymentsPanel projectId={projectId} rows={payments} /> : null}
        {tab === "changes" ? <ChangeOrdersPanel projectId={projectId} rows={changeOrders} /> : null}
      </div>
    </section>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">{children}</table>
    </div>
  );
}

const th = "px-3 py-2.5 font-semibold text-gray-600";
const td = "px-3 py-3 align-top";

function CostsPanel({ projectId, rows }: { projectId: string; rows: CostRow[] }) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddCostForm projectId={projectId} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No costs logged"
          hint="Log the first material, labor or subcon cost for this job."
          action={<AddCostForm projectId={projectId} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Category</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>{formatDate(row.date)}</td>
                <td className={td}>{CATEGORY_LABELS[row.category as CostCategory] ?? row.category}</td>
                <td className={td}>
                  {row.description}
                  {row.vendor ? <span className="block text-xs text-gray-500">{row.vendor}</span> : null}
                </td>
                <td className={`${td} text-right font-semibold`}>{formatRM(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}

function PaymentsPanel({ projectId, rows }: { projectId: string; rows: PaymentRow[] }) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddPaymentForm projectId={projectId} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No payments received"
          hint="Record each progress claim payment as it comes in."
          action={<AddPaymentForm projectId={projectId} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>{formatDate(row.date)}</td>
                <td className={`${td} text-right font-semibold`}>{formatRM(row.amount)}</td>
                <td className={td}>{row.reference ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}

function ChangeOrdersPanel({ projectId, rows }: { projectId: string; rows: ChangeOrderRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const update = (id: string, status: ChangeOrderStatus) => {
    startTransition(async () => {
      const result = await setChangeOrderStatus(id, status);
      if (result.ok) {
        toast.success(`Change order ${CHANGE_ORDER_LABELS[status].toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddChangeOrderForm projectId={projectId} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No change orders"
          hint="Add a change order when the client asks for extra work or omits some."
          action={<AddChangeOrderForm projectId={projectId} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const status = row.status as ChangeOrderStatus;
              return (
                <tr key={row.id}>
                  <td className={td}>{formatDate(row.date)}</td>
                  <td className={td}>{row.description}</td>
                  <td className={`${td} text-right font-semibold`}>{formatRM(row.amount)}</td>
                  <td className={td}>
                    <Badge tone={tone[status] ?? "gray"}>{CHANGE_ORDER_LABELS[status] ?? row.status}</Badge>
                    {status === "PENDING" ? (
                      <div className="mt-2 flex gap-2">
                        <Button small disabled={pending} onClick={() => update(row.id, "APPROVED")}>
                          Approve
                        </Button>
                        <Button small variant="secondary" disabled={pending} onClick={() => update(row.id, "REJECTED")}>
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
