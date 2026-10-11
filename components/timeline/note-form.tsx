"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { VoiceInput } from "@/components/ui/voice-input";
import { useOfflineSubmit } from "@/components/offline/use-offline-submit";

/** Say or type what happened. It is saved on the phone first if there is no signal. */
export function NoteForm({ projectId, close }: { projectId: string; close: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const { pending, submit } = useOfflineSubmit("Saved. This will appear in your evidence pack.", close);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return setError("Write or say something first.");
        submit({ type: "addNote", projectId, label: `Note: ${text.trim().slice(0, 40)}`, payload: { text: text.trim() } });
      }}
    >
      <Field label="Note" error={error}>
        <VoiceInput value={text} onChange={(e) => (setText(e.target.value), setError(""))} maxLength={2000} placeholder="What happened?" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}
