import Link from "next/link";
import { linkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { QuotesTable } from "@/components/quotes/quotes-table";
import { EmptyState } from "@/components/ui/empty-state";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/constants";
import { formatDate, formatRM } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { calculateQuote, quoteNumber } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const { locale, t } = await getT();
  const quotes = await prisma.quote.findMany({ include: { lines: true }, orderBy: { number: "desc" } });
  const newLink = (
    <Link href="/quotes/new" className={linkButton("primary")}>
      + New Quote
    </Link>
  );

  return (
    <>
      <PageHeader title={t.quotes}>{newLink}</PageHeader>
      {quotes.length === 0 ? (
        <EmptyState title="No quotes yet" hint="Build a quotation in minutes and turn it into a project when it is accepted." action={newLink} />
      ) : (
        <QuotesTable
          rows={quotes.map((q) => {
            const totals = calculateQuote(q.lines, q.sstEnabled, q.sstRate);
            return {
              id: q.id,
              number: quoteNumber(q.number),
              title: q.title,
              clientName: q.clientName,
              dateText: formatDate(q.date, locale),
              dateSort: q.date.getTime(),
              status: q.status,
              statusLabel: QUOTE_STATUS_LABELS[q.status as QuoteStatus] ?? q.status,
              total: formatRM(totals.total, locale),
              totalValue: totals.total,
            };
          })}
        />
      )}
    </>
  );
}
