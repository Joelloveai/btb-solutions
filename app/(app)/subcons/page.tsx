import Link from "next/link";
import { AddSubcontractorForm } from "@/components/forms/subcontractor-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubconsTable } from "@/components/subcons/subcons-table";
import { formatRM } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SubconsPage() {
  const { locale, t } = await getT();
  const money = (n: number) => formatRM(n, locale);
  const subs = await prisma.subcontractor.findMany({
    include: { costs: { where: { category: "SUBCON" } } },
    orderBy: { name: "asc" },
  });
  const rows = subs.map((s) => {
    const agreed = s.costs.reduce((t0, c) => t0.plus(c.amount), new Prisma.Decimal(0));
    const paid = s.costs.filter((c) => c.paidAt).reduce((t0, c) => t0.plus(c.amount), new Prisma.Decimal(0));
    return { sub: s, agreed: agreed.toNumber(), paid: paid.toNumber(), balance: agreed.minus(paid).toNumber() };
  });
  const totalOwed = rows.reduce((t0, r) => t0 + r.balance, 0);

  return (
    <>
      <PageHeader
        title={t.subcons}
        description={
          <>
            Total owed to subcontractors:{" "}
            <span className="font-mono font-semibold text-foreground" data-testid="subcon-total-owed">{money(totalOwed)}</span>
          </>
        }
      >
        <AddSubcontractorForm />
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="No subcontractors yet" hint="Add your subcons, then link them to SUBCON costs to see what you owe each one." action={<AddSubcontractorForm />} />
      ) : (
        <>
        <div className="hidden md:block">
          <SubconsTable
            rows={rows.map(({ sub, agreed, paid, balance }) => ({
              id: sub.id,
              name: sub.name,
              trade: sub.trade,
              agreed: money(agreed),
              agreedValue: agreed,
              paid: money(paid),
              paidValue: paid,
              balance: money(balance),
              balanceValue: balance,
            }))}
          />
        </div>
        <div className="space-y-2 md:hidden">
          {rows.map(({ sub, agreed, paid, balance }) => (
            <Link
              key={sub.id}
              href={`/subcons/${sub.id}`}
              className="block rounded-xl border bg-card p-3 shadow-sm hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{sub.name}</p>
                  <p className="text-sm text-muted-foreground">{sub.trade ?? "No trade set"}</p>
                </div>
                <p className={`text-right font-mono font-semibold tabular-nums ${balance > 0 ? "text-pending" : "text-profit"}`}>
                  {balance > 0 ? `Owed ${money(balance)}` : "Settled"}
                </p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-muted-foreground">Total agreed</dt><dd className="font-mono text-[13px] font-medium tabular-nums">{money(agreed)}</dd></div>
                <div><dt className="text-muted-foreground">Total paid</dt><dd className="font-mono text-[13px] font-medium tabular-nums">{money(paid)}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
        </>
      )}
    </>
  );
}
