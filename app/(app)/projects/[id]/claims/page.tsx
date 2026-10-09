import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaimsTable } from "@/components/claims/claims-table";
import { IssueClaimButton } from "@/components/claims/issue-claim-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ChevronLeft } from "lucide-react";
import { claimBalance } from "@/lib/claims";
import { formatDate, formatRM } from "@/lib/format";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function ClaimsPage({ params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { claims: { orderBy: { number: "desc" }, include: { payments: true } }, changeOrders: true },
  });
  if (!project) notFound();
  const locale = await getLocale();
  const money = (n: number) => formatRM(n, locale);
  const sum = (values: Prisma.Decimal.Value[]) => values.reduce<Prisma.Decimal>((t, v) => t.plus(v), new Prisma.Decimal(0));

  const approved = sum(project.changeOrders.filter((c) => c.status === "APPROVED").map((c) => c.amount));
  const claimedWork = sum(project.claims.map((c) => c.workDone));
  const claimableLeft = project.contractValue.plus(approved).minus(claimedWork).toNumber();
  const previousClaimed = sum(project.claims.map((c) => c.amountClaimed)).toNumber();

  return (
    <>
      <Link href={`/projects/${project.id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {project.name}
      </Link>
      <PageHeader
        title="Progress Claims"
        description={
          <>
            Worked on so far: {money(claimedWork.toNumber())} of {money(project.contractValue.plus(approved).toNumber())} · Retention{" "}
            {project.retentionPercent.toNumber()}%
          </>
        }
      >
        <IssueClaimButton
          projectId={project.id}
          retentionPercent={project.retentionPercent.toNumber()}
          sstEnabled={project.sstEnabled}
          sstRate={project.sstRate.toNumber()}
          previousClaimed={previousClaimed}
          claimableLeft={Math.max(0, claimableLeft)}
        />
      </PageHeader>

      {project.claims.length === 0 ? (
        <EmptyState title="No claims yet" hint="Issue your first progress claim when work is ready to be billed." />
      ) : (
        <ClaimsTable
          rows={project.claims.map((c) => {
            const { balance, paid } = claimBalance(c.netClaim, c.payments);
            return {
              id: c.id,
              projectId: project.id,
              number: c.number,
              dateText: formatDate(c.date, locale),
              dateSort: c.date.getTime(),
              workDone: money(c.workDone.toNumber()),
              retention: money(c.retentionAmount.toNumber()),
              netClaim: money(c.netClaim.toNumber()),
              netClaimValue: c.netClaim.toNumber(),
              balance: money(balance),
              balanceValue: balance,
              paidAny: paid > 0,
              canDelete: c.number === project.lastClaimNumber && c.payments.length === 0,
            };
          })}
        />
      )}
    </>
  );
}
