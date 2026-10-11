import { Prisma } from "@prisma/client";
import { Share2 } from "lucide-react";
import Link from "next/link";
import { FeedApproval, type FeedApprovalItem, type FeedMessage } from "@/components/client-portal/feed-approval";
import { PortalHeader } from "@/components/portal/portal-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/lib/constants";
import { calculateTotals } from "@/lib/calculations";
import { ensureWeeklyDigest } from "@/lib/client-digest";
import { formatDate, formatDateTime, formatRM, todayInMalaysia } from "@/lib/format";
import { completionPercent } from "@/lib/gantt";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { clientOrRedirect } from "@/lib/portal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const tone = { ACTIVE: "blue", COMPLETED: "green", ON_HOLD: "yellow", CANCELLED: "gray" } as const;
const scheduleLabel = { PAID: "Paid", PART_PAID: "Part paid", OUTSTANDING: "Outstanding" } as const;
const klDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(d);
const dayText = (key: string) => formatDate(new Date(`${key}T00:00:00.000Z`));
const RECENT_DAYS = 14;

/**
 * The homeowner's home: a feed, not a dashboard. What happened today, what is next, what they need to decide,
 * and where their payments stand. It selects only what a client may see: no costs, no subcontractor names, no GPS.
 */
export default async function ClientFeedPage() {
  const { clientId, clientUser } = await clientOrRedirect();
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
  const projects = await prisma.project.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      stage: true,
      contractValue: true,
      sstEnabled: true,
      sstRate: true,
      payments: { select: { amount: true } },
      paymentMilestones: { orderBy: { position: "asc" } },
      tasks: { select: { description: true, isMilestone: true, status: true, dueDate: true } },
      changeOrders: { where: { sentToClientAt: { not: null } }, orderBy: { date: "asc" }, select: { id: true, description: true, amount: true, status: true, clientDecision: true } },
      selections: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, category: true, details: true, photoId: true, status: true, approvedAt: true } },
      dailyLogs: { where: { date: { gte: since } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { id: true, date: true, note: true } },
      photos: { where: { kind: "PROGRESS", takenAt: { gte: since } }, orderBy: { takenAt: "desc" }, take: 60, select: { id: true, caption: true, takenAt: true, capturedAt: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, authorRole: true, body: true, targetId: true, createdAt: true } },
    },
  });
  const today = klDay(new Date());
  const todayDate = todayInMalaysia();
  const digests = await Promise.all(projects.filter((p) => p.status === "ACTIVE").map((p) => ensureWeeklyDigest(p.id)));

  return (
    <>
      <PortalHeader title="Your projects" home="/client/projects" signOutTo="/client/login" />
      <p className="mb-4 text-sm text-muted-foreground">Signed in as {clientUser.email}</p>
      {projects.length === 0 ? <EmptyState title="No projects yet" hint="Your contractor will link your project here." /> : null}

      <div className="space-y-10">
        {projects.map((p) => {
          const pct = completionPercent(p.tasks);
          const digest = digests.find((d) => d?.projectId === p.id) ?? null;
          const thread = (targetId: string): FeedMessage[] =>
            p.messages.filter((m) => m.targetId === targetId).map((m) => ({ id: m.id, from: m.authorRole === "client" ? "You" : "BTB Builders", body: m.body, whenText: formatDateTime(m.createdAt) }));

          const decisions: FeedApprovalItem[] = [
            ...p.changeOrders
              .filter((c) => c.status === "PENDING" && !c.clientDecision)
              .map((c) => ({ kind: "CHANGE_ORDER" as const, id: c.id, title: c.description, detail: null, amountText: formatRM(c.amount.toNumber()), photoId: null, messages: thread(c.id) })),
            ...p.selections
              .filter((s) => !s.approvedAt)
              .map((s) => ({ kind: "SELECTION" as const, id: s.id, title: s.name, detail: [s.category, s.details].filter(Boolean).join(" · ") || null, amountText: null, photoId: s.photoId, messages: thread(s.id) })),
          ];

          // Days, newest first: notes and photos together.
          const days = new Map<string, { notes: string[]; photos: { id: string; caption: string | null }[] }>();
          const slot = (key: string) => days.get(key) ?? days.set(key, { notes: [], photos: [] }).get(key)!;
          for (const log of p.dailyLogs) slot(log.date.toISOString().slice(0, 10)).notes.push(log.note);
          for (const photo of p.photos) slot(klDay(photo.capturedAt ?? photo.takenAt)).photos.push({ id: photo.id, caption: photo.caption });
          const todays = days.get(today);
          const earlier = Array.from(days.entries()).filter(([key]) => key < today).sort(([a], [b]) => b.localeCompare(a));

          const nextMilestone = p.tasks.filter((t) => t.isMilestone && t.status === "OPEN" && t.dueDate >= todayDate).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

          const approved = p.changeOrders.filter((c) => c.status === "APPROVED");
          const { billableTotal } = calculateTotals({ contractValue: p.contractValue, costs: [], payments: p.payments, changeOrders: approved.map((c) => ({ amount: c.amount, status: c.status })), sstEnabled: p.sstEnabled, sstRate: p.sstRate });
          const received = p.payments.reduce((t, x) => t.plus(x.amount), new Prisma.Decimal(0));
          const schedule = buildPaymentSchedule(p.paymentMilestones.map((m) => ({ id: m.id, label: m.label, percent: m.percent, dueDate: m.dueDate })), billableTotal, received, todayDate);
          const nextPayment = schedule.find((m) => m.status !== "PAID");

          return (
            <section key={p.id} aria-label={`Feed for ${p.name}`} className="space-y-3" data-testid="feed">
              <header className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{p.name}</h2>
                <Badge tone={tone[p.status as ProjectStatus] ?? "gray"}>{PROJECT_STATUS_LABELS[p.status as ProjectStatus] ?? p.status}</Badge>
                <p className="w-full text-sm text-muted-foreground">
                  {p.stage ? `Now: ${p.stage}. ` : ""}
                  {pct === null ? "No tasks scheduled yet." : `${pct}% complete.`}
                </p>
              </header>

              {decisions.length > 0 ? (
                <div className="space-y-2" data-testid="feed-decisions">
                  <h3 className="text-sm font-semibold text-pending-dark">Needs your decision ({decisions.length})</h3>
                  {decisions.map((d) => (
                    <FeedApproval key={`${d.kind}-${d.id}`} item={d} />
                  ))}
                </div>
              ) : null}

              <Card className="space-y-2 p-4" data-testid="feed-today">
                <h3 className="text-sm font-semibold text-muted-foreground">Today</h3>
                {todays && (todays.notes.length > 0 || todays.photos.length > 0) ? (
                  <>
                    {todays.notes.map((n, i) => (
                      <p key={i} className="text-base">{n}</p>
                    ))}
                    {todays.photos.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto" data-testid="feed-today-photos">
                        {todays.photos.map((ph) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={ph.id} src={`/api/photos/${ph.id}`} alt={ph.caption ?? "Progress photo"} loading="lazy" className="h-28 w-28 shrink-0 rounded-lg border object-cover" />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No update yet today.</p>
                )}
              </Card>

              {nextMilestone ? (
                <Card className="p-4" data-testid="feed-next">
                  <h3 className="text-sm font-semibold text-muted-foreground">Next milestone</h3>
                  <p className="text-base font-medium">{nextMilestone.description}</p>
                  <p className="text-sm text-muted-foreground">Due {formatDate(nextMilestone.dueDate)}</p>
                </Card>
              ) : null}

              {schedule.length > 0 ? (
                <Card className="p-4" data-testid="feed-payments">
                  <h3 className="text-sm font-semibold text-muted-foreground">Your payments</h3>
                  <p className="text-base">
                    {formatRM(received.toNumber())} paid of {formatRM(billableTotal)}
                  </p>
                  {nextPayment ? (
                    <p className="text-sm text-muted-foreground">
                      Next: {nextPayment.label}, {formatRM(nextPayment.amount)}
                      {nextPayment.dueDate ? `, due ${formatDate(nextPayment.dueDate)}` : ""} ({scheduleLabel[nextPayment.status].toLowerCase()})
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Every instalment is paid. Thank you.</p>
                  )}
                </Card>
              ) : null}

              {digest ? (
                <Card className="space-y-2 border-primary/30 p-4" data-testid="feed-digest">
                  <h3 className="text-sm font-semibold text-muted-foreground">Your week · {formatDate(digest.weekEnding)}</h3>
                  <p className="text-base">{digest.body}</p>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${p.name}: ${digest.body}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" /> Share on WhatsApp
                  </a>
                </Card>
              ) : null}

              {earlier.length > 0 ? (
                <div className="space-y-2" data-testid="feed-earlier">
                  <h3 className="text-sm font-semibold text-muted-foreground">Earlier</h3>
                  {earlier.map(([key, day]) => (
                    <Card key={key} className="space-y-2 p-3">
                      <p className="text-sm font-medium">{dayText(key)}</p>
                      {day.notes.map((n, i) => (
                        <p key={i} className="text-sm">{n}</p>
                      ))}
                      {day.photos.length > 0 ? (
                        <div className="flex gap-2 overflow-x-auto">
                          {day.photos.slice(0, 6).map((ph) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={ph.id} src={`/api/photos/${ph.id}`} alt={ph.caption ?? "Progress photo"} loading="lazy" className="h-20 w-20 shrink-0 rounded-md border object-cover" />
                          ))}
                        </div>
                      ) : null}
                    </Card>
                  ))}
                </div>
              ) : null}

              <Link href={`/client/projects/${p.id}`} className="inline-flex min-h-12 items-center text-sm font-medium underline underline-offset-2">
                See the full project
              </Link>
            </section>
          );
        })}
      </div>

      {projects.length > 0 ? (
        <section aria-label="Your projects" className="mt-10">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">All your projects</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((p) => {
              const pct = completionPercent(p.tasks);
              return (
                <li key={p.id}>
                  <Link href={`/client/projects/${p.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="p-4 transition-colors hover:border-primary/40">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold leading-snug">{p.name}</h3>
                        <Badge tone={tone[p.status as ProjectStatus] ?? "gray"}>{PROJECT_STATUS_LABELS[p.status as ProjectStatus] ?? p.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{pct === null ? "No tasks scheduled yet" : `${pct}% complete`}</p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
