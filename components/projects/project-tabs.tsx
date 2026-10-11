"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
import { PendingOps } from "@/components/offline/pending-ops";
import { BeforeCoverChecklist } from "@/components/photos/before-cover-checklist";
import { linkButton } from "@/components/ui/button";
import { BEFORE_COVER_ITEMS } from "@/lib/constants";
import { Download } from "lucide-react";
import { PhotoGallery, type PhotoItem } from "@/components/photos/photo-gallery";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { TasksPanel, type TaskRow } from "@/components/tasks/tasks-panel";
import { AddChangeOrderForm } from "@/components/forms/add-change-order-form";
import { AddCostForm } from "@/components/forms/add-cost-form";
import { AddPaymentForm } from "@/components/forms/add-payment-form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  { id: "photos", label: "Progress Photos" },
  { id: "tasks", label: "Tasks" },
] as const;

const tone = { PENDING: "yellow", APPROVED: "green", REJECTED: "red" } as const;

export function ProjectTabs({
  projectId,
  costs,
  payments,
  changeOrders,
  boq,
  unallocatedActual,
  lookups,
  photos,
  checklistCounts,
  floorPlans,
  tasks,
}: {
  projectId: string;
  costs: CostRow[];
  payments: PaymentRow[];
  changeOrders: ChangeOrderRow[];
  boq: BoqRow[];
  /** Costs that are not linked to any BOQ line. */
  unallocatedActual: number;
  lookups: Lookups;
  photos: PhotoItem[];
  /** How many photos each "before cover" item already has. */
  checklistCounts: Record<string, number>;
  floorPlans: PhotoItem[];
  tasks: TaskRow[];
}) {
  const t = useT();
  const beforeCoverMissing = BEFORE_COVER_ITEMS.filter((item) => !checklistCounts[item.key]).length;

  return (
    <Tabs defaultValue="costs" className="w-full">
      <TabsList className="flex overflow-x-auto">
        {TABS.map((item) => (
          <TabsTrigger key={item.id} value={item.id} className="shrink-0 flex-1 px-3">
            {item.label in t ? t[item.label as keyof typeof t] : item.label}
            {item.id === "photos" && beforeCoverMissing > 0 ? (
              <span aria-hidden="true" className="ml-1.5 rounded-full bg-pending-light px-1.5 text-[10px] font-semibold text-pending-dark">
                {beforeCoverMissing}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="costs">
        <PendingOps projectId={projectId} types={["addCost"]} />
        <CostsPanel projectId={projectId} rows={costs} lookups={lookups} />
      </TabsContent>
      <TabsContent value="payments">
        <PendingOps projectId={projectId} types={["addPayment"]} />
        <PaymentsPanel projectId={projectId} rows={payments} lookups={lookups} />
      </TabsContent>
      <TabsContent value="changes">
        <ChangeOrdersPanel projectId={projectId} rows={changeOrders} lookups={lookups} />
      </TabsContent>
      <TabsContent value="boq">
        <BoqPanel projectId={projectId} rows={boq} unallocatedActual={unallocatedActual} />
      </TabsContent>
      <TabsContent value="photos">
        <div className="space-y-6">
          <BeforeCoverChecklist projectId={projectId} counts={checklistCounts} />
          <section aria-label="Progress photos" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Progress photos</h3>
              <a href={`/api/projects/${projectId}/evidence`} download className={linkButton("secondary", true)}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Evidence Package
              </a>
            </div>
            <PendingOps projectId={projectId} types={["uploadPhoto"]} />
            <PhotoUpload kind="PROGRESS" projectId={projectId} label="Add progress photo" />
            <PhotoGallery photos={photos} canDelete organize compare emptyText="No progress photos yet. Photos you add here appear in the client's portal." />
          </section>
          <section aria-label="Floor plans" className="space-y-3">
            <h3 className="text-sm font-semibold">Floor plans</h3>
            <PhotoUpload kind="FLOORPLAN" projectId={projectId} label="Add floor plan" />
            <PhotoGallery photos={floorPlans} canDelete emptyText="No floor plan uploaded." />
          </section>
        </div>
      </TabsContent>
      <TabsContent value="tasks">
        <PendingOps projectId={projectId} types={["createTask", "completeTask"]} />
        <TasksPanel projectId={projectId} rows={tasks} lookups={lookups} />
      </TabsContent>
    </Tabs>
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
    <div className="relative rounded-xl border border-border bg-card shadow-sm md:overflow-x-auto">
      <table className="block w-full text-left text-sm md:table md:min-w-[600px]">{children}</table>
    </div>
  );
}

const dateValue = (iso: string) => iso.slice(0, 10);
const actionsTh = <th className="w-28 px-3 py-2.5"><span className="sr-only">Actions</span></th>;
const th = "h-9 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const td = "px-3 py-3 align-top";
// Below the md breakpoint each row is a card: a two-column grid with the amount always visible
// on the first line. From md up the same markup is an ordinary table row.
const tbodyCls = "block divide-y divide-border md:table-row-group";
const theadCls = "hidden bg-muted/60 md:table-header-group";
const rowCls = "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 p-3 md:table-row md:p-0";
const cell = "p-0 align-top md:table-cell md:px-3 md:py-3 md:col-auto md:row-auto";
const mAmount = `${cell} col-start-2 row-start-1 text-right font-mono font-semibold tabular-nums`;
const mMain = `${cell} col-start-1 row-start-1 font-medium md:font-normal`;
const mSub = `${cell} col-start-1 row-start-2 text-xs text-muted-foreground md:text-sm md:text-foreground`;
const mSubRight = `${cell} col-start-2 row-start-2 text-right text-xs text-muted-foreground md:text-left md:text-sm md:text-foreground`;
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
                  {row.vendor ? <span className="block text-xs text-muted-foreground">{row.vendor}</span> : null}
                  {row.subconName ? <span className="block text-xs text-muted-foreground">Subcon: {row.subconName}</span> : null}
                  {row.boqLabel ? <span className="block text-xs text-muted-foreground">BOQ: {row.boqLabel}</span> : null}
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
                  {row.claimNumber ? <span className="block text-xs text-muted-foreground">Claim {row.claimNumber}</span> : null}
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
                    {row.boqLabel ? <span className="block text-xs text-muted-foreground">BOQ: {row.boqLabel}</span> : null}
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
                <td className={`${cell} col-span-3 text-right text-xs text-muted-foreground md:text-sm`}>
                  {row.qty} {row.unit} × {formatRM(row.rate)}
                </td>
                <td data-label="Budget" className={`${cell} text-right font-mono tabular-nums before:block before:text-[11px] before:font-sans before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden`}>{formatRM(row.budget)}</td>
                <td data-label="Actual" className={`${cell} text-right font-mono tabular-nums before:block before:text-[11px] before:font-sans before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden`}>{formatRM(row.actual)}</td>
                <td data-label="Remaining" className={`${cell} text-right font-mono font-semibold tabular-nums before:block before:text-[11px] before:font-sans before:font-normal before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden ${row.remaining < 0 ? "text-loss" : "text-profit"}`}>
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
              <tr className="grid grid-cols-[1fr_auto] gap-x-3 bg-muted/60 p-3 md:table-row md:p-0">
                <td className={`${cell} text-muted-foreground`} colSpan={3}>
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
