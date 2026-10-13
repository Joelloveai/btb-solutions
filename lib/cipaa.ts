const DAY = 86_400_000;

/** Whole calendar days from the claim date to today (both held as dates). */
export const daysSince = (claimDate: Date, today: Date) => Math.floor((today.getTime() - claimDate.getTime()) / DAY);

export type AgingBand = "0-30" | "31-60" | "61-90" | "90+";
export const AGING_BANDS: AgingBand[] = ["0-30", "31-60", "61-90", "90+"];
export const bandOf = (days: number): AgingBand => (days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");

/** Totals per age band, for unpaid claims only. */
export function agingTotals(rows: { days: number; balance: number }[]): Record<AgingBand, number> {
  const out: Record<AgingBand, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const r of rows) if (r.balance > 0) out[bandOf(r.days)] = Math.round((out[bandOf(r.days)] + r.balance) * 100) / 100;
  return out;
}

export const PAYMENT_RESPONSE_DAYS = 30;
export const ADJUDICATION_NOTICE_DAYS = 60;

export type CipaaStage = "WITHIN_TERMS" | "PAYMENT_RESPONSE" | "ADJUDICATION";

/**
 * Where an unpaid claim stands. After 30 days a Payment Response notice is due; after 60 a Notice of
 * Adjudication can be served. (Thresholds as set for BTB; the statute's own deadlines run from other
 * dates, so these templates are a prompt, not legal advice.)
 */
export function cipaaStage(days: number, unpaid: boolean): CipaaStage {
  if (!unpaid || days < PAYMENT_RESPONSE_DAYS) return "WITHIN_TERMS";
  return days >= ADJUDICATION_NOTICE_DAYS ? "ADJUDICATION" : "PAYMENT_RESPONSE";
}

/** Plain-words countdown for one unpaid claim. */
export function cipaaCountdown(days: number, unpaid: boolean): string {
  if (!unpaid) return "Paid";
  if (days < PAYMENT_RESPONSE_DAYS) return `Payment response notice in ${PAYMENT_RESPONSE_DAYS - days} day${PAYMENT_RESPONSE_DAYS - days === 1 ? "" : "s"}`;
  if (days < ADJUDICATION_NOTICE_DAYS) return `Notice of adjudication in ${ADJUDICATION_NOTICE_DAYS - days} day${ADJUDICATION_NOTICE_DAYS - days === 1 ? "" : "s"}`;
  return `${days - ADJUDICATION_NOTICE_DAYS} day${days - ADJUDICATION_NOTICE_DAYS === 1 ? "" : "s"} past the adjudication threshold`;
}

export type NoticeKind = "payment-response" | "adjudication";

/** The wording of the two notices. Placeholders the system cannot know are shown in [square brackets]. */
export function noticeText(kind: NoticeKind, d: { claimNumber: string; claimDateText: string; amountText: string; balanceText: string; days: number; clientName: string; projectName: string; contractRef: string | null; todayText: string }) {
  const ref = d.contractRef ? ` (contract ${d.contractRef})` : "";
  if (kind === "payment-response") {
    return {
      title: "PAYMENT RESPONSE NOTICE",
      subtitle: "Construction Industry Payment and Adjudication Act 2012 (CIPAA)",
      paragraphs: [
        `Date: ${d.todayText}`,
        `To: ${d.clientName}`,
        `Re: ${d.projectName}${ref}. Payment claim ${d.claimNumber} dated ${d.claimDateText}`,
        `Our payment claim ${d.claimNumber} for ${d.amountText} was served on ${d.claimDateText}. ${d.days} days have passed and ${d.balanceText} remains unpaid.`,
        `We have not received a payment response to this claim. Under CIPAA a party who receives a payment claim must give a written payment response, stating the amount it accepts and its reasons for any amount it disputes. A claim that is not answered within the time allowed by the Act is treated as wholly disputed, and we are entitled to refer the dispute to adjudication.`,
        `Please pay ${d.balanceText} or send your written payment response within [number] days of the date of this notice. If we do not hear from you, we will treat the claim as disputed and will consider our remedies under the Act, including adjudication.`,
        `This is a template prepared by the system. Please have it checked by your lawyer before it is sent.`,
      ],
    };
  }
  return {
    title: "NOTICE OF ADJUDICATION",
    subtitle: "Construction Industry Payment and Adjudication Act 2012 (CIPAA)",
    paragraphs: [
      `Date: ${d.todayText}`,
      `To: ${d.clientName}`,
      `Re: ${d.projectName}${ref}. Payment claim ${d.claimNumber} dated ${d.claimDateText}`,
      `We give notice that we are commencing adjudication under the Construction Industry Payment and Adjudication Act 2012 in respect of the payment dispute described below.`,
      `1. The parties: the Claimant is BTB Builders Sdn Bhd; the Respondent is ${d.clientName}.`,
      `2. The contract: the construction contract for ${d.projectName}${ref}.`,
      `3. The dispute: payment claim ${d.claimNumber} for ${d.amountText}, served on ${d.claimDateText}. ${d.days} days have passed. ${d.balanceText} remains unpaid and no payment response has been given.`,
      `4. The remedy sought: payment of ${d.balanceText}, together with interest and costs as the adjudicator may decide.`,
      `5. The adjudicator: we propose [name of adjudicator], or ask that one be appointed through the Asian International Arbitration Centre (AIAC).`,
      `This is a template prepared by the system. Please have it checked by your lawyer before it is served.`,
    ],
  };
}
