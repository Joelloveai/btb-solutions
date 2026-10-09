import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { Badge } from "@/components/ui/badge";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/constants";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { calculateQuote, quoteNumber } from "@/lib/quotes";

export const dynamic = "force-dynamic";

const tone = { DRAFT: "gray", SENT: "blue", ACCEPTED: "green", REJECTED: "red" } as const;

export default async function QuotePage({ params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({ where: { id: params.id }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!quote) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const totals = calculateQuote(quote.lines, quote.sstEnabled, quote.sstRate);
  const status = quote.status as QuoteStatus;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/quotes" className="text-sm font-medium text-brand">
        ← Quotes
      </Link>
      <header className="mb-4 mt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">
            {quoteNumber(quote.number)} · {quote.title}
          </h1>
          <Badge tone={tone[status] ?? "gray"}>{QUOTE_STATUS_LABELS[status] ?? quote.status}</Badge>
        </div>
        <p className="text-slate-600">
          {quote.clientName} · {formatDate(quote.date, locale)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!quote.projectId ? (
            <Link href={`/quotes/${quote.id}/edit`} className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">
              Edit Quote
            </Link>
          ) : null}
          <Link
            href={`/quotes/${quote.id}/print`}
            target="_blank"
            className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white"
          >
            Print / PDF
          </Link>
        </div>
      </header>

      <div className="mb-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 font-semibold">Unit</th>
              <th className="px-3 py-2.5 text-right font-semibold">Unit Price</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2.5">{l.description}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.qty.toString()}</td>
                <td className="px-3 py-2.5">{l.unit}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{money(l.unitPrice.toNumber())}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(l.amount.toNumber())}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-5 ml-auto max-w-xs rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex justify-between py-1"><span>Subtotal</span><span data-testid="quote-subtotal">{money(totals.subtotal)}</span></div>
        {quote.sstEnabled ? (
          <div className="flex justify-between py-1"><span>SST ({Number(quote.sstRate)}%)</span><span>{money(totals.sst)}</span></div>
        ) : null}
        <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
          <span>Total</span><span data-testid="quote-total">{money(totals.total)}</span>
        </div>
      </div>

      {quote.notes ? <p className="mb-5 whitespace-pre-line text-sm text-slate-600">{quote.notes}</p> : null}

      <QuoteActions id={quote.id} status={status} projectId={quote.projectId} />
    </div>
  );
}
