"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { certifyClaim, setClaimDisputed } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Button, linkButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { VoiceInput } from "@/components/ui/voice-input";
import { useCan } from "@/components/permissions-provider";

/** The steps after a claim is sent: certify it, flag a dispute, and prepare CIPAA notices when it goes unpaid. */
export function ClaimActions({
  claimId,
  netClaim,
  status,
  countdown,
  canPaymentResponse,
  canAdjudication,
  hasCertificate,
  unpaid,
}: {
  claimId: string;
  netClaim: string;
  status: string;
  countdown: string;
  canPaymentResponse: boolean;
  canAdjudication: boolean;
  hasCertificate: boolean;
  unpaid: boolean;
}) {
  const allowed = useCan();
  const [certifying, setCertifying] = useState(false);
  const [amount, setAmount] = useState(netClaim);
  const [by, setBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const cert = useSubmit("Claim certified", () => setCertifying(false));
  const dispute = useSubmit(status === "DISPUTED" ? "No longer disputed" : "Marked as disputed", () => {});
  const write = allowed("money.write");

  return (
    <section aria-label="Claim steps" className="mx-auto mb-4 max-w-2xl space-y-3 print:hidden" data-testid="claim-actions">
      <p className="rounded-lg bg-muted px-3 py-2 text-sm" data-testid="cipaa-countdown">
        {countdown}
      </p>
      <div className="flex flex-wrap gap-2">
        {write && unpaid && status !== "CERTIFIED" && status !== "PAID" ? <Button onClick={() => setCertifying(true)}>Certify claim</Button> : null}
        {write && unpaid && status !== "PAID" ? (
          <Button variant="secondary" disabled={dispute.pending} onClick={() => dispute.submit(() => setClaimDisputed(claimId, status !== "DISPUTED"))}>
            {status === "DISPUTED" ? "Not disputed any more" : "Mark as disputed"}
          </Button>
        ) : null}
        {hasCertificate ? (
          <a href={`/api/claims/${claimId}/certificate`} target="_blank" rel="noreferrer" className={linkButton("secondary")}>
            <FileText className="h-4 w-4" aria-hidden="true" /> Certificate (PDF)
          </a>
        ) : null}
        {write && canPaymentResponse ? (
          <a href={`/api/claims/${claimId}/notice?type=payment-response`} className={linkButton("accent")}>
            Payment response notice
          </a>
        ) : null}
        {write && canAdjudication ? (
          <a href={`/api/claims/${claimId}/notice?type=adjudication`} className={linkButton("accent")}>
            Notice of adjudication
          </a>
        ) : null}
      </div>
      <Modal open={certifying} onClose={() => setCertifying(false)} title="Certify claim">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            cert.submit(async () => {
              const r = await certifyClaim(claimId, { certifiedAmount: amount, certifiedBy: by, remarks });
              if (!r.ok) setError(r.error);
              return r;
            });
          }}
        >
          <Field label="Amount certified (RM)">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Certified by">
            <Input value={by} onChange={(e) => setBy(e.target.value)} placeholder="e.g. QS Ahmad, Ar. Lim" required />
          </Field>
          <Field label="Remarks (optional)">
            <VoiceInput multiline value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={500} />
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={cert.pending}>
            {cert.pending ? "Saving…" : "Save certificate"}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
