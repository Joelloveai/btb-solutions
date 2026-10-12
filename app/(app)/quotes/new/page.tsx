import Link from "next/link";
import { requireFinancialsPage } from "@/lib/guards";
import { QuoteForm } from "@/components/quotes/quote-form";

export default async function NewQuotePage() {
  await requireFinancialsPage();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/quotes" className="text-sm font-medium text-foreground">
        ← Quotes
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">New Quote</h1>
      <QuoteForm />
    </div>
  );
}
