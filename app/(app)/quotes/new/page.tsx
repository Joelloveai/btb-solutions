import Link from "next/link";
import { QuoteForm } from "@/components/quotes/quote-form";

export default function NewQuotePage() {
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
