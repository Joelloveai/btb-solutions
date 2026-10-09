"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { convertQuoteToProject, setQuoteStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { QUOTE_STATUSES, QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/constants";

export function QuoteActions({
  id,
  status,
  projectId,
}: {
  id: string;
  status: QuoteStatus;
  projectId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: QuoteStatus) =>
    startTransition(async () => {
      const result = await setQuoteStatus(id, next);
      if (result.ok) {
        toast.success(`Quote marked ${QUOTE_STATUS_LABELS[next].toLowerCase()}`);
        router.refresh();
      } else toast.error(result.error);
    });

  const convert = () =>
    startTransition(async () => {
      const result = await convertQuoteToProject(id);
      if (result.ok && result.data) {
        toast.success("Project created from quote");
        router.push(`/projects/${result.data.id}`);
        router.refresh();
      } else if (!result.ok) toast.error(result.error);
    });

  if (projectId) {
    return (
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex h-12 items-center rounded-lg bg-brand px-5 font-semibold text-white"
      >
        Open project
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "ACCEPTED" ? (
        <Button onClick={convert} disabled={pending}>
          Convert to Project
        </Button>
      ) : null}
      {QUOTE_STATUSES.filter((s) => s !== status).map((s) => (
        <Button key={s} variant="secondary" disabled={pending} onClick={() => change(s)}>
          Mark as {QUOTE_STATUS_LABELS[s]}
        </Button>
      ))}
    </div>
  );
}
