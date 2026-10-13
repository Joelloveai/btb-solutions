import Link from "next/link";
import { requireFinancialsPage } from "@/lib/guards";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { claimBalance } from "@/lib/claims";
import { PAYMENT_TERMS_DAYS } from "@/lib/company-config";
import { formatDate, formatRM, todayInMalaysia } from "@/lib/format";
import { getT } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { summarizeProject } from "@/lib/project-summary";
import { ageBucket, BUCKET_STYLES, daysOverdue } from "@/lib/receivables";
import { AGING_BANDS, agingTotals, cipaaCountdown, cipaaStage, daysSince } from "@/lib/cipaa";
import { claimReminderLink } from "@/lib/whatsapp";
import { ReceivablesTable } from "@/components/receivables/receivables-table";
import { Card } from "@/components/ui/card";
import { linkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function ReceivablesPage() {
  await requireFinancialsPage();
  const { locale, t } = await getT();
  const money = (n: number) => formatRM(n, locale);
  const today = todayInMalaysia();

  const claims = await prisma.claim.findMany({
    include: { project: { include: { Client: true } }, payments: true },
  });
  const open = claims
    .map((c) => {
      const { balance, paid } = claimBalance(c.netClaim, c.payments);
      const days = daysOverdue(c.date, today);
      const age = daysSince(c.date, today);
      const claimNo = c.claimNumber ?? `Claim ${c.number}`;
      return {
        claim: c,
        balance,
        paid,
        days,
        age,
        claimNo,
        countdown: cipaaCountdown(age, balance > 0),
        stage: cipaaStage(age, balance > 0),
        whatsapp: claimReminderLink({ phone: c.project.Client?.phone, clientName: c.project.clientName ?? "there", claimNumber: claimNo, project: c.project.name, balanceText: formatRM(balance, locale), days: age }),
      };
    })
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.days - a.days || a.claim.date.getTime() - b.claim.date.getTime());
  const totalOwed = open.reduce((t0, r) => t0 + r.balance, 0);
  const aging = agingTotals(open.map((r) => ({ days: r.age, balance: r.balance })));

  const projects = await prisma.project.findMany({
    include: { costs: true, payments: true, changeOrders: true, claims: true },
  });
  const retention = projects
    .map((p) => ({ project: p, summary: summarizeProject(p) }))
    .filter((r) => r.summary.retentionOutstanding > 0);

  const status = (r: (typeof open)[number]) => (r.paid > 0 ? "Partly paid" : r.days > 0 ? "Overdue" : "Unpaid");
  const bandStyle = { "0-30": "current", "31-60": "late", "61-90": "overdue", "90+": "critical" } as const;
  const bucketTone = { current: "green", late: "yellow", overdue: "orange", critical: "red" } as const;

  return (
    <>
      <PageHeader
        title={t.receivables}
        description={
          <>
        Claims are due {PAYMENT_TERMS_DAYS} days after the claim date. Total waiting to be collected:{" "}
        <span className="font-semibold text-foreground" data-testid="total-owed">{money(totalOwed)}</span>
      </>
        }
      />

      <section aria-label="Age of unpaid claims" className="mb-5">
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">How old the unpaid claims are (days since the claim date)</h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {AGING_BANDS.map((band) => (
            <div key={band} className={`rounded-xl border p-3 ${BUCKET_STYLES[bandStyle[band]]}`} data-testid={`aging-${band}`}>
              <p className="text-xs font-semibold">{band} days</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{money(aging[band])}</p>
            </div>
          ))}
        </div>
      </section>

      {open.length === 0 ? (
        <EmptyState title="Nothing outstanding" hint="Every issued claim has been paid." />
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {open.map((r) => (
              <div key={r.claim.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.claim.project.clientName ?? "No client"}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.claim.project.name} · Claim {r.claim.number}
                    </p>
                  </div>
                  <Badge tone={bucketTone[ageBucket(r.days)]}>{`${r.days} days`}</Badge>
                </div>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{money(r.balance)}</p>
                <p className="text-sm text-muted-foreground">
                  {status(r)} · issued {formatDate(r.claim.date, locale)}
                </p>
                <p className="mt-1 text-sm font-medium" data-testid="cipaa-countdown">{r.claimNo}: {r.countdown}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href={`/receivables/${r.claim.id}/reminder`} target="_blank" className={linkButton("accent", true)}>
                    Generate Reminder
                  </Link>
                  {r.whatsapp ? (
                    <a href={r.whatsapp} target="_blank" rel="noreferrer" className={linkButton("secondary", true)}>
                      WhatsApp reminder
                    </a>
                  ) : null}
                  <Link href={`/projects/${r.claim.projectId}/claims/${r.claim.id}`} className={linkButton("secondary", true)}>
                    {r.stage === "WITHIN_TERMS" ? "Open claim" : r.stage === "PAYMENT_RESPONSE" ? "Payment response notice" : "Notice of adjudication"}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <ReceivablesTable
              rows={open.map((r) => ({
                claimId: r.claim.id,
                projectId: r.claim.projectId,
                client: r.claim.project.clientName ?? "—",
                project: r.claim.project.name,
                claimNumber: r.claim.number,
                balance: money(r.balance),
                balanceValue: r.balance,
                issuedText: formatDate(r.claim.date, locale),
                issuedSort: r.claim.date.getTime(),
                days: r.days,
                bucket: ageBucket(r.days),
                status: status(r),
                claimNo: r.claimNo,
                countdown: r.countdown,
                stage: r.stage,
                whatsapp: r.whatsapp,
              }))}
            />
          </div>
        </>
      )}

      {retention.length > 0 ? (
        <section className="mt-8" aria-label="Retention outstanding">
          <h2 className="mb-2 text-base font-semibold">Retention to collect</h2>
          <div className="space-y-2">
            {retention.map(({ project, summary }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-sm hover:border-primary/40"
              >
                <div>
                  <p className="font-semibold">{project.name}</p>
                  <p className="text-sm text-muted-foreground">{project.clientName ?? "No client"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold tabular-nums">{money(summary.retentionOutstanding)}</span>
                  <Badge tone={project.status === "COMPLETED" ? "yellow" : "gray"}>
                    {project.status === "COMPLETED" ? "Ready to release" : "Held until completion"}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
