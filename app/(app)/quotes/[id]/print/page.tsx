import { notFound } from "next/navigation";
import { Letterhead } from "@/components/layout/letterhead";
import { PrintButton } from "@/components/print-button";
import { QUOTE_TERMS, QUOTE_VALID_DAYS } from "@/lib/company-config";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { calculateQuote, quoteNumber } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({ params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({ where: { id: params.id }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!quote) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const totals = calculateQuote(quote.lines, quote.sstEnabled, quote.sstRate);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <article className="rounded-xl border border-slate-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <Letterhead />
        <h2 className="my-4 text-lg font-bold uppercase tracking-wide">Quotation {quoteNumber(quote.number)}</h2>
        <dl className="mb-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-600">To</dt><dd className="font-semibold">{quote.clientName}</dd>
          <dt className="text-slate-600">Project</dt><dd className="font-semibold">{quote.title}</dd>
          <dt className="text-slate-600">Date</dt><dd className="font-semibold">{formatDate(quote.date, locale)}</dd>
          <dt className="text-slate-600">Valid for</dt><dd className="font-semibold">{QUOTE_VALID_DAYS} days</dd>
        </dl>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-slate-300">
            <tr>
              <th className="py-2">No.</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2">Unit</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quote.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right">{l.qty.toString()}</td>
                <td className="py-2">{l.unit}</td>
                <td className="py-2 text-right">{money(l.unitPrice.toNumber())}</td>
                <td className="py-2 text-right font-semibold">{money(l.amount.toNumber())}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-4 max-w-xs text-sm">
          <div className="flex justify-between py-1"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
          {quote.sstEnabled ? (
            <div className="flex justify-between py-1"><span>SST ({Number(quote.sstRate)}%)</span><span>{money(totals.sst)}</span></div>
          ) : null}
          <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold">
            <span>Total</span><span>{money(totals.total)}</span>
          </div>
        </div>
        <section className="mt-6 text-sm text-slate-700">
          <h3 className="mb-1 font-semibold">Terms</h3>
          <ul className="list-disc pl-5">
            {[...(quote.notes ? [quote.notes] : []), ...QUOTE_TERMS].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
