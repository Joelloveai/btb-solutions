"use client";

import { useState } from "react";
import { replyToClient } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { VoiceInput } from "@/components/ui/voice-input";

export type MessageRow = { id: string; fromClient: boolean; name: string; body: string; whenText: string; aboutText: string | null; targetType: string | null; targetId: string | null };

/** What the homeowner has asked, with a reply box. Replies show under the item in their feed. */
export function MessagesPanel({ projectId, rows, hasClient }: { projectId: string; rows: MessageRow[]; hasClient: boolean }) {
  const [replyTo, setReplyTo] = useState<MessageRow | null>(null);
  const [text, setText] = useState("");
  const { pending, submit } = useSubmit("Reply sent", () => (setReplyTo(null), setText("")));
  if (!hasClient && rows.length === 0) return null;
  return (
    <section aria-label="Messages from the client" className="mt-6 space-y-2">
      <h3 className="text-base font-semibold">Messages</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet. A question from the homeowner appears here.</p> : null}
      <ul className="space-y-2">
        {rows.map((m) => (
          <li key={m.id}>
            <Card className="space-y-1 p-3" data-testid="message-row">
              <p className="text-xs text-muted-foreground">
                {m.fromClient ? `${m.name} asked` : `${m.name} replied`}
                {m.aboutText ? ` about ${m.aboutText}` : ""} · {m.whenText}
              </p>
              <p className="text-sm">{m.body}</p>
              {m.fromClient ? (
                <Button small variant="secondary" onClick={() => setReplyTo(m)}>
                  Reply
                </Button>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      <Modal open={!!replyTo} onClose={() => setReplyTo(null)} title="Reply to the homeowner">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">They asked: {replyTo?.body}</p>
          <VoiceInput multiline aria-label="Your reply" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
          <Button className="w-full" disabled={pending || !text.trim()} onClick={() => replyTo && submit(() => replyToClient(projectId, text, replyTo.targetType ?? undefined, replyTo.targetId ?? undefined))}>
            {pending ? "Sending…" : "Send reply"}
          </Button>
        </div>
      </Modal>
    </section>
  );
}
