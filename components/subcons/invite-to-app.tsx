"use client";

import { MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createSubInvite } from "@/app/actions";
import { Button, linkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** "Invite to app": makes a one-time link and a ready-to-send WhatsApp message. The contractor taps send. */
export function InviteToApp({ subcontractorId, hasLogin }: { subcontractorId: string; hasLogin: boolean }) {
  const [invite, setInvite] = useState<{ url: string; whatsappUrl: string; phone: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card className="mb-5 space-y-3 p-4" role="region" aria-label="Invite to app">
      <div>
        <h2 className="text-base font-semibold">Phone and PIN login</h2>
        <p className="text-sm text-muted-foreground">
          {hasLogin ? "This subcontractor has already joined with a phone number." : "Send them a WhatsApp link. They choose a 6-digit PIN and see their tasks and what they are owed. No email or password."}
        </p>
      </div>
      {!hasLogin ? (
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await createSubInvite(subcontractorId);
              if (result.ok) setInvite(result.data!);
              else toast.error(result.error);
            })
          }
        >
          {pending ? "Making link…" : "Invite to app"}
        </Button>
      ) : null}
      {invite ? (
        <div className="space-y-2" data-testid="invite-result">
          <a href={invite.whatsappUrl} target="_blank" rel="noreferrer" className={linkButton("accent")}>
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Send on WhatsApp
          </a>
          <p className="break-all rounded-md bg-muted p-2 text-xs" data-testid="invite-url">
            {invite.url}
          </p>
          <p className="text-xs text-muted-foreground">The link works once and expires in 7 days.</p>
        </div>
      ) : null}
    </Card>
  );
}
