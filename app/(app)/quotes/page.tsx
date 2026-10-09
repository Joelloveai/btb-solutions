import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/constants";
import { formatDate, formatRM } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { calculateQuote, quoteNumber } from "@/lib/quotes";

export const dynamic = "force-dynamic";

const tone = { DRAFT: "gray", SENT: "blue", ACCEPTED: "green", REJECTED: "red" } as const;

export default async function QuotesPage() {
  const { locale, t } = await getT();
  const quotes = await prisma.quote.findMany({ include: { lines: true }, orderBy: { number: "desc" } });
  const newLink = (
    <Link href="/quotes/new" className="inline-flex h-12 items-center rounded-lg bg-brand px-5 font-semibold text-white">
      + New Quote
    </Link>
  );

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.quotes}</h1>
        {newLink}
      </div>
      {quotes.length === 0 ? (
        <EmptyState title="No quotes yet" hint="Build a quotation in minutes and turn it into a project when it is accepted." action={newLink} />
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => {
            const totals = calculateQuote(q.lines, q.sstEnabled, q.sstRate);
            const status = q.status as QuoteStatus;
            return (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 hover:border-brand"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {quoteNumber(q.number)} · {q.title}
                  </p>
                  <p className="text-sm text-slate-600">
                    {q.clientName} · {formatDate(q.date, locale)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">{formatRM(totals.total, locale)}</span>
                  <Badge tone={tone[status] ?? "gray"}>{QUOTE_STATUS_LABELS[status] ?? q.status}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
