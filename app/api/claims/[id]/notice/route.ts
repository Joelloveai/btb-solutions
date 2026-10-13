import { getServerSession } from "next-auth";
import { authOptions, roleOf } from "@/lib/auth";
import { buildNoticePdf } from "@/lib/claim-pdf";
import { claimBalance } from "@/lib/claims";
import { ADJUDICATION_NOTICE_DAYS, PAYMENT_RESPONSE_DAYS, daysSince, type NoticeKind } from "@/lib/cipaa";
import { formatDate, formatRM, todayInMalaysia } from "@/lib/format";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { appendEvent, recorded } from "@/lib/timeline";
import { actorFromSession } from "@/lib/timeline-actor";

export const dynamic = "force-dynamic";

/**
 * A CIPAA notice for an unpaid claim, as a PDF on the company letterhead:
 *   ?type=payment-response   available once 30 days have passed
 *   ?type=adjudication       available once 60 days have passed
 * Generating one is recorded on the project timeline. Managers and admins only.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (roleOf(session) !== "staff") return new Response("Not signed in", { status: 401 });
  if (!can(session?.user?.staffRole, "money.write")) return new Response("Not allowed", { status: 403 });
  const type = new URL(request.url).searchParams.get("type");
  if (type !== "payment-response" && type !== "adjudication") return new Response("Unknown notice", { status: 400 });
  const kind: NoticeKind = type;

  const claim = await prisma.claim.findUnique({ where: { id: params.id }, include: { project: true, payments: true } });
  if (!claim) return new Response("Not found", { status: 404 });
  const { balance } = claimBalance(claim.netClaim, claim.payments);
  if (balance <= 0) return new Response("This claim is already paid.", { status: 409 });
  const today = todayInMalaysia();
  const days = daysSince(claim.date, today);
  const needed = kind === "payment-response" ? PAYMENT_RESPONSE_DAYS : ADJUDICATION_NOTICE_DAYS;
  if (days < needed) return new Response(`This notice is available after ${needed} days. The claim is ${days} days old.`, { status: 409 });

  const claimNumber = claim.claimNumber ?? `Claim ${claim.number}`;
  const bytes = await buildNoticePdf(kind, {
    claimNumber,
    claimDateText: formatDate(claim.date),
    amountText: formatRM(claim.netClaim.toNumber()),
    balanceText: formatRM(balance),
    days,
    clientName: claim.project.clientName ?? "The Respondent",
    projectName: claim.project.name,
    contractRef: claim.project.contractRef,
    todayText: formatDate(today),
  });
  await recorded(async (tx) => {
    await appendEvent(tx, {
      projectId: claim.projectId,
      type: "CLAIM",
      actor: actorFromSession(session),
      title: `${kind === "payment-response" ? "Payment response notice" : "Notice of adjudication"} prepared for ${claimNumber}`,
      description: `${formatRM(balance)} unpaid after ${days} days`,
      metadata: { action: "cipaa-notice", claimId: claim.id, kind, days },
    });
  });
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${kind}-${claimNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf"`, "Cache-Control": "no-store" },
  });
}
