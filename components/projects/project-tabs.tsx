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
              "h-11 whitespace-nowrap rounded-lg px-1 text-[13px] font-semibold sm:text-sm",
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
    <div className="relative rounded-xl border border-gray-200 bg-white md:overflow-x-auto">
      <table className="block w-full text-left text-sm md:table md:min-w-[600px]">{children}</table>
    </div>
  );
}

const dateValue = (iso: string) => iso.slice(0, 10);
const actionsTh = <th className="w-28 px-3 py-2.5"><span className="sr-only">Actions</span></th>;
const th = "px-3 py-2.5 font-semibold text-gray-600";
const td = "px-3 py-3 align-top";
// Below the md breakpoint each row is a card: a two-column grid with the amount always visible
// on the first line. From md up the same markup is an ordinary table row.
const tbodyCls = "block divide-y divide-gray-100 md:table-row-group";
const theadCls = "hidden bg-gray-50 md:table-header-group";
const rowCls = "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 p-3 md:table-row md:p-0";
const cell = "p-0 align-top md:table-cell md:px-3 md:py-3 md:col-auto md:row-auto";
const mAmount = `${cell} col-start-2 row-start-1 text-right font-mono font-semibold tabular-nums`;
const mMain = `${cell} col-start-1 row-start-1 font-medium md:font-normal`;
const mSub = `${cell} col-start-1 row-start-2 text-xs text-gray-500 md:text-sm md:text-gray-900`;
const mSubRight = `${cell} col-start-2 row-start-2 text-right text-xs text-gray-500 md:text-sm md:text-gray-900`;
const mActions = `${cell} col-span-2 row-start-3`;

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
          <thead className={theadCls}>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Category</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {rows.map((row) => (
              <tr key={row.id} className={rowCls}>
                <td className={mSub}>{formatDate(row.date)}</td>
                <td className={mSubRight}>{CATEGORY_LABELS[row.category as CostCategory] ?? row.category}</td>
                <td className={mMain}>
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
                <td className={mAmount}>{formatRM(row.amount)}</td>
                <td className={mActions}>
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
          <thead className={theadCls}>
            <tr>
              <th className={th}>Date</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Reference</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {rows.map((row) => (
              <tr key={row.id} className={rowCls}>
                <td className={mMain}>{formatDate(row.date)}</td>
                <td className={mAmount}>{formatRM(row.amount)}</td>
                <td className={mSub}>
                  {row.reference ?? "—"}
                  {row.claimNumber ? <span className="block text-xs text-gray-500">Claim {row.claimNumber}</span> : null}
                </td>
                <td className={mActions}>
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
          <thead className={theadCls}>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}>Status</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {rows.map((row) => {
              const status = row.status as ChangeOrderStatus;
              return (
                <tr key={row.id} className={rowCls}>
                  <td className={mSub}>{formatDate(row.date)}</td>
                  <td className={mMain}>
                    {row.description}
                    {row.boqLabel ? <span className="block text-xs text-gray-500">BOQ: {row.boqLabel}</span> : null}
                  </td>
                  <td className={mAmount}>{formatRM(row.amount)}</td>
                  <td className={mSubRight}>
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
                  <td className={mActions}>
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
          <thead className={theadCls}>
            <tr>
              <th className={th}>Item</th>
              <th className={`${th} text-right`}>Qty × Rate</th>
              <th className={`${th} text-right`}>Budget</th>
              <th className={`${th} text-right`}>Actual</th>
              <th className={`${th} text-right`}>Remaining</th>
              {actionsTh}
            </tr>
          </thead>
          <tbody className={tbodyCls}>
            {rows.map((row) => (
              <tr key={row.id} className="grid grid-cols-3 gap-x-3 gap-y-1 p-3 md:table-row md:p-0">
                <td className={`${cell} col-span-3 font-medium md:font-normal`}>{row.description}</td>
                <td className={`${cell} col-span-3 text-right text-xs text-gray-600 md:text-sm`}>
                  {row.qty} {row.unit} × {formatRM(row.rate)}
                </td>
                <td data-label="Budget" className={`${cell} text-right font-mono tabular-nums before:block before:text-[11px] before:font-sans before:font-normal before:text-gray-500 before:content-[attr(data-label)] md:before:hidden`}>{formatRM(row.budget)}</td>
                <td data-label="Actual" className={`${cell} text-right font-mono tabular-nums before:block before:text-[11px] before:font-sans before:font-normal before:text-gray-500 before:content-[attr(data-label)] md:before:hidden`}>{formatRM(row.actual)}</td>
                <td data-label="Remaining" className={`${cell} text-right font-mono font-semibold tabular-nums before:block before:text-[11px] before:font-sans before:font-normal before:text-gray-500 before:content-[attr(data-label)] md:before:hidden ${row.remaining < 0 ? "text-loss" : "text-profit"}`}>
                  {formatRM(row.remaining)}
                </td>
                <td className={`${cell} col-span-3`}>
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
              <tr className="grid grid-cols-[1fr_auto] gap-x-3 bg-gray-50 p-3 md:table-row md:p-0">
                <td className={`${cell} text-gray-600`} colSpan={3}>
                  Costs not linked to a BOQ line
                </td>
                <td className={`${cell} text-right font-mono tabular-nums`}>{formatRM(unallocatedActual)}</td>
                <td className="hidden md:table-cell" colSpan={2} />
              </tr>
            ) : null}
          </tbody>
        </TableShell>
      )}
    </>
  );
}
