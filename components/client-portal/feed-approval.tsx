"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveSelection, askClientQuestion, decideChangeOrder } from "@/app/actions";
import { useOffline } from "@/components/offline/offline-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { VoiceInput } from "@/components/ui/voice-input";
import { Confirm } from "./approvals";

export type FeedMessage = { id: string; from: "You" | "BTB Builders"; body: string; whenText: string };
export type FeedApprovalItem = {
  kind: "CHANGE_ORDER" | "SELECTION";
  id: string;
  title: string;
  detail: string | null;
  /** The price put to the client (change orders only). */
  amountText: string | null;
  photoId: string | null;
  messages: FeedMessage[];
};

const OFFLINE = "You are offline. An approval is recorded with the time it reaches us, so please try again when you have signal.";

/** One decision put to the homeowner: a photo, what it is, and two big buttons. */
export function FeedApproval({ item }: { item: FeedApprovalItem }) {
  const router = useRouter();
  const { online } = useOffline();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");

  const approve = () =>
    startTransition(async () => {
      if (!online) return void toast.error(OFFLINE);
      const result = item.kind === "CHANGE_ORDER" ? await decideChangeOrder(item.id, "APPROVED") : await approveSelection(item.id);
      if (result.ok) {
        toast.success("Approved. Thank you.");
        setConfirming(false);
        router.refresh();
      } else toast.error(result.error);
    });

  const send = () =>
    startTransition(async () => {
      if (!online) return void toast.error("You are offline. Please send your question when you have signal.");
      const result = await askClientQuestion({ targetType: item.kind, targetId: item.id, body: question });
      if (result.ok) {
        toast.success("Sent. We will reply here.");
        setQuestion("");
        setAsking(false);
        router.refresh();
      } else toast.error(result.error);
    });

  return (
    <Card className="space-y-3 p-4" data-testid="feed-approval">
      <div className="flex items-start gap-3">
        {item.photoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photos/${item.photoId}`} alt={`Photo: ${item.title}`} loading="lazy" className="h-24 w-24 shrink-0 rounded-lg border object-cover" />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-pending-dark">{item.kind === "CHANGE_ORDER" ? "Change to your job" : "Please choose"}</p>
          <p className="font-medium leading-snug">{item.title}</p>
          {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
          {item.amountText ? <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{item.amountText}</p> : null}
        </div>
      </div>
      {item.messages.length > 0 ? (
        <ul className="space-y-1 rounded-lg bg-muted p-2 text-sm" aria-label="Your messages about this">
          {item.messages.map((m) => (
            <li key={m.id}>
              <span className="font-medium">{m.from}:</span> {m.body} <span className="text-xs text-muted-foreground">{m.whenText}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setConfirming(true)}>Approve</Button>
        <Button variant="secondary" onClick={() => setAsking(true)}>
          Ask a Question
        </Button>
      </div>

      <Confirm
        open={confirming}
        title={item.kind === "CHANGE_ORDER" ? "Approve this change?" : "Approve this choice?"}
        description={`${item.title}${item.amountText ? `: ${item.amountText}. This changes the price of your job.` : "."} Your decision is recorded with the date and time.`}
        confirmLabel="Yes, approve"
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={approve}
      />
      <Modal open={asking} onClose={() => setAsking(false)} title="Ask a question">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">About: {item.title}</p>
          <VoiceInput multiline aria-label="Your question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder="Type or tap the microphone" />
          <Button className="w-full" onClick={send} disabled={pending || !question.trim()}>
            {pending ? "Sending…" : "Send question"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
