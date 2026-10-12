import Link from "next/link";
import { requireFinancialsPage } from "@/lib/guards";
import { notFound } from "next/navigation";
import { QuoteActions } from "@/components/quotes/quote-actions";
import { Badge } from "@/components/ui/badge";
import { linkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft } from "lucide-react";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/constants";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { calculateQuote, quoteNumber } from "@/lib/quotes";

export const dynamic = "force-dynamic";

const tone = { DRAFT: "gray", SENT: "blue", ACCEPTED: "green", REJECTED: "red" } as const;

export default async function QuotePage({ params }: { params: { id: string } }) {
  await requireFinancialsPage();
  const quote = await prisma.quote.findUnique({ where: { id: params.id }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!quote) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const totals = calculateQuote(quote.lines, quote.sstEnabled, quote.sstRate);
  const status = quote.status as QuoteStatus;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/quotes" className="min-h-12 mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Quotes
      </Link>
      <PageHeader
        title={`${quoteNumber(quote.number)} · ${quote.title}`}
        description={
          <>
            {quote.clientName} · {formatDate(quote.date, locale)}
          </>
        }
      >
        <Badge tone={tone[status] ?? "gray"}>{QUOTE_STATUS_LABELS[status] ?? quote.status}</Badge>
        {!quote.projectId ? (
          <Link href={`/quotes/${quote.id}/edit`} className={linkButton("secondary", true)}>
            Edit Quote
          </Link>
        ) : null}
        <Link href={`/quotes/${quote.id}/print`} target="_blank" className={linkButton("accent", true)}>
          Print / PDF
        </Link>
      </PageHeader>

      <Card className="mb-4 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quote.lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.description}</TableCell>
                <TableCell className="text-right font-mono text-[13px] tabular-nums">{l.qty.toString()}</TableCell>
                <TableCell>{l.unit}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-mono text-[13px] tabular-nums">{money(l.unitPrice.toNumber())}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-mono text-[13px] font-semibold tabular-nums">{money(l.amount.toNumber())}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="mb-5 ml-auto max-w-xs p-4 font-mono text-sm tabular-nums">
        <div className="flex justify-between py-1"><span className="font-sans">Subtotal</span><span data-testid="quote-subtotal">{money(totals.subtotal)}</span></div>
        {quote.sstEnabled ? (
          <div className="flex justify-between py-1"><span className="font-sans">SST ({Number(quote.sstRate)}%)</span><span>{money(totals.sst)}</span></div>
        ) : null}
        <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
          <span className="font-sans">Total</span><span data-testid="quote-total">{money(totals.total)}</span>
        </div>
      </Card>

      {quote.notes ? <p className="mb-5 whitespace-pre-line text-sm text-muted-foreground">{quote.notes}</p> : null}

      <QuoteActions id={quote.id} status={status} projectId={quote.projectId} />
    </div>
  );
}
