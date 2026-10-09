import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuoteForm } from "@/components/quotes/quote-form";
import type { QuoteStatus } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { quoteNumber } from "@/lib/quotes";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({ params }: { params: { id: string } }) {
  const quote = await prisma.quote.findUnique({ where: { id: params.id }, include: { lines: { orderBy: { position: "asc" } } } });
  if (!quote) notFound();
  if (quote.projectId) redirect(`/quotes/${quote.id}`);
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/quotes/${quote.id}`} className="text-sm font-medium text-foreground">
        ← {quoteNumber(quote.number)}
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Edit Quote</h1>
      <QuoteForm
        quoteId={quote.id}
        values={{
          clientName: quote.clientName,
          title: quote.title,
          date: quote.date.toISOString().slice(0, 10),
          sstEnabled: quote.sstEnabled,
          status: quote.status as QuoteStatus,
          notes: quote.notes ?? "",
          lines: quote.lines.map((l) => ({
            description: l.description,
            qty: l.qty.toString(),
            unit: l.unit,
            unitPrice: l.unitPrice.toFixed(2),
          })),
        }}
      />
    </div>
  );
}
