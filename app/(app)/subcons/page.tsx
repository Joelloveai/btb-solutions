import Link from "next/link";
import { AddSubcontractorForm } from "@/components/forms/subcontractor-form";
import { EmptyState } from "@/components/ui/empty-state";
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
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.subcons}</h1>
        <AddSubcontractorForm />
      </div>
      <p className="mb-5 text-sm text-slate-600">
        Total owed to subcontractors:{" "}
        <span className="font-semibold text-slate-900" data-testid="subcon-total-owed">{money(totalOwed)}</span>
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No subcontractors yet" hint="Add your subcons, then link them to SUBCON costs to see what you owe each one." action={<AddSubcontractorForm />} />
      ) : (
        <div className="space-y-2">
          {rows.map(({ sub, agreed, paid, balance }) => (
            <Link
              key={sub.id}
              href={`/subcons/${sub.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-[0.6rem] hover:border-brand md:p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{sub.name}</p>
                  <p className="text-sm text-slate-600">{sub.trade ?? "No trade set"}</p>
                </div>
                <p className={`text-right font-bold tabular-nums ${balance > 0 ? "text-pending-dark" : "text-profit-dark"}`}>
                  {balance > 0 ? `Owed ${money(balance)}` : "Settled"}
                </p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-slate-500">Total agreed</dt><dd className="font-semibold">{money(agreed)}</dd></div>
                <div><dt className="text-slate-500">Total paid</dt><dd className="font-semibold">{money(paid)}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
