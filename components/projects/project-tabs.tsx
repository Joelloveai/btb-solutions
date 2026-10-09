"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteBoqLine,
  deleteChangeOrder,
  deleteCost,
  deletePayment,
  setChangeOrderStatus,
} from "@/app/actions";
import { EditChangeOrderButton } from "@/components/forms/add-change-order-form";
import { EditCostButton } from "@/components/forms/add-cost-form";
import { EditPaymentButton } from "@/components/forms/add-payment-form";
import { AddBoqLineForm, EditBoqLineButton } from "@/components/forms/boq-line-form";
import { DeleteIconButton } from "@/components/forms/row-actions";
import { MarkPaidButton } from "@/components/subcons/mark-paid-button";
import type { Lookups } from "./lookups";
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
import { formatDate, formatRM as formatMoney } from "@/lib/format";
import { useLocale, useT } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

export type CostRow = {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  reference: string | null;
  subcontractorId: string | null;
  subconName: string | null;
  boqLineId: string | null;
  boqLabel: string | null;
  paidAt: string | null;
};
export type PaymentRow = {
  id: string;
  date: string;
  amount: number;
  reference: string | null;
  claimId: string | null;
  claimNumber: number | null;
};
export type ChangeOrderRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  boqLineId: string | null;
  boqLabel: string | null;
};
export type BoqRow = {
  id: string;
  description: string;
  qty: string;
  unit: string;
  rate: number;
  amount: number;
  /** BOQ amount plus approved change orders linked to this line. */
  budget: number;
  actual: number;
  remaining: number;
};

const TABS = [
  { id: "costs", label: "costs" },
  { id: "payments", label: "payments" },
  { id: "changes", label: "changeOrders" },
  { id: "boq", label: "BOQ" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const tone = { PENDING: "yellow", APPROVED: "green", REJECTED: "red" } as const;

export function ProjectTabs({
  projectId,
  costs,
  payments,
  changeOrders,
  boq,
  unallocatedActual,
  lookups,
}: {
  projectId: string;
  costs: CostRow[];
  payments: PaymentRow[];
  changeOrders: ChangeOrderRow[];
  boq: BoqRow[];
  /** Costs that are not linked to any BOQ line. */
  unallocatedActual: number;
  lookups: Lookups;
}) {
  const [tab, setTab] = useState<TabId>("costs");
  const t = useT();

  return (
    <section>
      <div role="tablist" className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-gray-200 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={clsx(
              "h-11 rounded-lg text-sm font-semibold",
              tab === item.id ? "bg-white text-brand shadow" : "text-gray-600",
            )}
          >
            {item.label === "BOQ" ? "BOQ" : t[item.label]}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "costs" ? <CostsPanel projectId={projectId} rows={costs} lookups={lookups} /> : null}
        {tab === "payments" ? <PaymentsPanel projectId={projectId} rows={payments} lookups={lookups} /> : null}
        {tab === "changes" ? <ChangeOrdersPanel projectId={projectId} rows={changeOrders} lookups={lookups} /> : null}
        {tab === "boq" ? <BoqPanel projectId={projectId} rows={boq} unallocatedActual={unallocatedActual} /> : null}
      </div>
    </section>
  );
}

function useFormatters() {
  const locale: Locale = useLocale();
  return {
    formatRM: (value: number) => formatMoney(value, locale),
    formatDate: (value: string) => formatDate(value, locale),
  };
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[600px] text-left text-sm">{children}</table>
    </div>
  );
}

const dateValue = (iso: string) => iso.slice(0, 10);
const actionsTh = <th className="w-28 px-3 py-2.5"><span className="sr-only">Actions</span></th>;
const th = "px-3 py-2.5 font-semibold text-gray-600";
const td = "px-3 py-3 align-top";

function CostsPanel({ projectId, rows, lookups }: { projectId: string; rows: CostRow[]; lookups: Lookups }) {
  const { formatRM, formatDate } = useFormatters();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddCostForm projectId={projectId} lookups={lookups} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No costs logged"
          hint="Log the first material, labor or subcon cost for this job."
          action={<AddCostForm projectId={projectId} lookups={lookups} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Category</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
              {actionsTh}
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
                  {row.subconName ? <span className="block text-xs text-gray-500">Subcon: {row.subconName}</span> : null}
                  {row.boqLabel ? <span className="block text-xs text-gray-500">BOQ: {row.boqLabel}</span> : null}
                  {row.category === "SUBCON" ? (
                    <div className="mt-1">
                      <MarkPaidButton costId={row.id} paidAt={row.paidAt} />
                    </div>
                  ) : null}
                </td>
                <td className={`${td} text-right font-semibold`}>{formatRM(row.amount)}</td>
                <td className={td}>
                  <div className="flex justify-end">
                    <EditCostButton
                      projectId={projectId}
                      lookups={lookups}
                      id={row.id}
                      values={{
                        date: dateValue(row.date),
                        category: row.category as CostCategory,
                        description: row.description,
                        amount: String(row.amount),
                        vendor: row.vendor ?? "",
                        reference: row.reference ?? "",
                        subcontractorId: row.subcontractorId ?? "",
                        boqLineId: row.boqLineId ?? "",
                      }}
                    />
                    <DeleteIconButton
                      label="Delete cost"
                      message={`Delete this cost of ${formatRM(row.amount)}?`}
                      onConfirm={() => deleteCost(row.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}

function PaymentsPanel({ projectId, rows, lookups }: { projectId: string; rows: PaymentRow[]; lookups: Lookups }) {
  const { formatRM, formatDate } = useFormatters();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddPaymentForm projectId={projectId} lookups={lookups} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No payments received"
          hint="Record each progress claim payment as it comes in."
          action={<AddPaymentForm projectId={projectId} lookups={lookups} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Reference</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>{formatDate(row.date)}</td>
                <td className={`${td} text-right font-semibold`}>{formatRM(row.amount)}</td>
                <td className={td}>
                  {row.reference ?? "—"}
                  {row.claimNumber ? <span className="block text-xs text-gray-500">Claim {row.claimNumber}</span> : null}
                </td>
                <td className={td}>
                  <div className="flex justify-end">
                    <EditPaymentButton
                      projectId={projectId}
                      lookups={lookups}
                      id={row.id}
                      values={{
                        date: dateValue(row.date),
                        amount: String(row.amount),
                        reference: row.reference ?? "",
                        claimId: row.claimId ?? "",
                      }}
                    />
                    <DeleteIconButton
                      label="Delete payment"
                      message={`Delete this payment of ${formatRM(row.amount)}?`}
                      onConfirm={() => deletePayment(row.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </>
  );
}

function ChangeOrdersPanel({ projectId, rows, lookups }: { projectId: string; rows: ChangeOrderRow[]; lookups: Lookups }) {
  const { formatRM, formatDate } = useFormatters();
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
        <AddChangeOrderForm projectId={projectId} lookups={lookups} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No change orders"
          hint="Add a change order when the client asks for extra work or omits some."
          action={<AddChangeOrderForm projectId={projectId} lookups={lookups} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Status</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const status = row.status as ChangeOrderStatus;
              return (
                <tr key={row.id}>
                  <td className={td}>{formatDate(row.date)}</td>
                  <td className={td}>
                    {row.description}
                    {row.boqLabel ? <span className="block text-xs text-gray-500">BOQ: {row.boqLabel}</span> : null}
                  </td>
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
                  <td className={td}>
                    <div className="flex justify-end">
                      <EditChangeOrderButton
                        projectId={projectId}
                        lookups={lookups}
                        id={row.id}
                        values={{
                          date: dateValue(row.date),
                          description: row.description,
                          amount: String(row.amount),
                          boqLineId: row.boqLineId ?? "",
                        }}
                      />
                      <DeleteIconButton
                        label="Delete change order"
                        message={`Delete this change order of ${formatRM(row.amount)}?`}
                        onConfirm={() => deleteChangeOrder(row.id)}
                      />
                    </div>
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

function BoqPanel({ projectId, rows, unallocatedActual }: { projectId: string; rows: BoqRow[]; unallocatedActual: number }) {
  const { formatRM } = useFormatters();
  return (
    <>
      <div className="mb-3 flex justify-end">
        <AddBoqLineForm projectId={projectId} />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No BOQ yet"
          hint="Add the work items for this job, or convert an accepted quote to get one automatically."
          action={<AddBoqLineForm projectId={projectId} />}
        />
      ) : (
        <TableShell>
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Qty × Rate</th>
              <th className={`${th} text-right`}>Budget</th>
              <th className={`${th} text-right`}>Actual</th>
              <th className={`${th} text-right`}>Remaining</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className={td}>{row.description}</td>
                <td className={`${td} text-right text-gray-600`}>
                  {row.qty} {row.unit} × {formatRM(row.rate)}
                </td>
                <td className={`${td} text-right`}>{formatRM(row.budget)}</td>
                <td className={`${td} text-right`}>{formatRM(row.actual)}</td>
                <td className={`${td} text-right font-semibold ${row.remaining < 0 ? "text-loss" : "text-profit"}`}>
                  {formatRM(row.remaining)}
                </td>
                <td className={td}>
                  <div className="flex justify-end">
                    <EditBoqLineButton
                      projectId={projectId}
                      id={row.id}
                      values={{ description: row.description, qty: row.qty, unit: row.unit, rate: row.rate.toFixed(2) }}
                    />
                    <DeleteIconButton
                      label="Delete BOQ line"
                      message={`Delete "${row.description}" from the BOQ?`}
                      onConfirm={() => deleteBoqLine(row.id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {unallocatedActual !== 0 ? (
              <tr className="bg-gray-50">
                <td className={td} colSpan={3}>
                  Costs not linked to a BOQ line
                </td>
                <td className={`${td} text-right`}>{formatRM(unallocatedActual)}</td>
                <td className={td} colSpan={2} />
              </tr>
            ) : null}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
