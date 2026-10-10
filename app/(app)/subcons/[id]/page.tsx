import Link from "next/link";
import { notFound } from "next/navigation";
import { EditSubcontractorButton } from "@/components/forms/subcontractor-form";
import { MarkPaidButton } from "@/components/subcons/mark-paid-button";
import { LoginAccess } from "@/components/portal/login-access";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SubconPage({ params }: { params: { id: string } }) {
  const sub = await prisma.subcontractor.findUnique({
    where: { id: params.id },
    include: {
      costs: { where: { category: "SUBCON" }, orderBy: { date: "desc" }, include: { project: true } },
      users: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!sub) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const sum = (rows: { amount: Prisma.Decimal }[]) => rows.reduce((t, c) => t.plus(c.amount), new Prisma.Decimal(0));
  const agreed = sum(sub.costs);
  const paid = sum(sub.costs.filter((c) => c.paidAt));

  return (
    <>
      <Link href="/subcons" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Subcons
      </Link>
      <PageHeader title={sub.name} description={[sub.trade, sub.contact, sub.bank].filter(Boolean).join(" · ") || "No details yet"}>
        <EditSubcontractorButton
          id={sub.id}
          values={{ name: sub.name, contact: sub.contact ?? "", trade: sub.trade ?? "", bank: sub.bank ?? "" }}
        />
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <KpiCard label="Total agreed" value={money(agreed.toNumber())} testId="sub-agreed" />
        <KpiCard label="Total paid" value={money(paid.toNumber())} testId="sub-paid" />
        <div className="col-span-2 sm:col-span-1">
          <KpiCard label="Balance owed" value={money(agreed.minus(paid).toNumber())} tone={agreed.minus(paid).greaterThan(0) ? "pending" : "neutral"} testId="sub-balance" />
        </div>
      </div>

      <LoginAccess
        title="Task log login"
        description="Lets this subcontractor see the tasks you assign them, mark them done and upload a photo."
        loginPath="/login"
        users={sub.users.map((u) => ({ id: u.id, email: u.email, name: u.name }))}
        kind="sub"
        ownerId={sub.id}
      />

      {sub.costs.length === 0 ? (
        <EmptyState title="No costs linked" hint="When you add a SUBCON cost on a project, pick this subcontractor on it." />
      ) : (
        <div className="space-y-2">
          {sub.costs.map((c) => (
            <div key={c.id} className="rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{c.description}</p>
                  <p className="text-sm text-muted-foreground">
                    <Link href={`/projects/${c.projectId}`} className="text-foreground hover:underline">{c.project.name}</Link>
                    {" · "}
                    {formatDate(c.date, locale)}
                  </p>
                </div>
                <p className="font-mono font-semibold tabular-nums">{money(c.amount.toNumber())}</p>
              </div>
              <div className="mt-2">
                <MarkPaidButton costId={c.id} paidAt={c.paidAt ? c.paidAt.toISOString() : null} />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
