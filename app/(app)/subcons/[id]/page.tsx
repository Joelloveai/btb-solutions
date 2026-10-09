import Link from "next/link";
import { notFound } from "next/navigation";
import { EditSubcontractorButton } from "@/components/forms/subcontractor-form";
import { MarkPaidButton } from "@/components/subcons/mark-paid-button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SubconPage({ params }: { params: { id: string } }) {
  const sub = await prisma.subcontractor.findUnique({
    where: { id: params.id },
    include: { costs: { where: { category: "SUBCON" }, orderBy: { date: "desc" }, include: { project: true } } },
  });
  if (!sub) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const sum = (rows: { amount: Prisma.Decimal }[]) => rows.reduce((t, c) => t.plus(c.amount), new Prisma.Decimal(0));
  const agreed = sum(sub.costs);
  const paid = sum(sub.costs.filter((c) => c.paidAt));

  return (
    <>
      <Link href="/subcons" className="text-sm font-medium text-brand">
        ← Subcons
      </Link>
      <header className="mb-4 mt-2">
        <h1 className="text-2xl font-bold">{sub.name}</h1>
        <p className="text-slate-600">
          {[sub.trade, sub.contact, sub.bank].filter(Boolean).join(" · ") || "No details yet"}
        </p>
        <div className="mt-3">
          <EditSubcontractorButton
            id={sub.id}
            values={{ name: sub.name, contact: sub.contact ?? "", trade: sub.trade ?? "", bank: sub.bank ?? "" }}
          />
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Total agreed" value={money(agreed.toNumber())} testId="sub-agreed" />
        <Stat label="Total paid" value={money(paid.toNumber())} testId="sub-paid" />
        <Stat label="Balance owed" value={money(agreed.minus(paid).toNumber())} testId="sub-balance" />
      </div>

      {sub.costs.length === 0 ? (
        <EmptyState title="No costs linked" hint="When you add a SUBCON cost on a project, pick this subcontractor on it." />
      ) : (
        <div className="space-y-2">
          {sub.costs.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-[0.6rem] md:p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{c.description}</p>
                  <p className="text-sm text-slate-600">
                    <Link href={`/projects/${c.projectId}`} className="text-brand hover:underline">{c.project.name}</Link>
                    {" · "}
                    {formatDate(c.date, locale)}
                  </p>
                </div>
                <p className="font-bold tabular-nums">{money(c.amount.toNumber())}</p>
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

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-xl font-bold" data-testid={testId}>{value}</p>
    </div>
  );
}
