"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { changeOwnPassword, updateOwnName } from "@/app/actions";
import { useSubmit } from "@/components/forms/use-submit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

export function ProfileForms(props: { name: string; mustChange: boolean }) {
  return (
    <SessionProvider>
      <Forms {...props} />
    </SessionProvider>
  );
}

function Forms({ name, mustChange }: { name: string; mustChange: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [fullName, setFullName] = useState(name);
  const names = useSubmit("Name saved", () => {});
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== again) return setError("The two new passwords do not match.");
    setSaving(true);
    const result = await changeOwnPassword(current, next);
    if (!result.ok) {
      setSaving(false);
      return setError(result.error);
    }
    // Lift the "choose a password" gate for this session, then carry on.
    await update();
    toast.success("Password changed.");
    setCurrent("");
    setNext("");
    setAgain("");
    setSaving(false);
    router.push(mustChange ? "/projects" : "/settings/profile");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-5">
      {mustChange ? (
        <p role="status" className="rounded-lg bg-pending-light px-3 py-2 text-sm font-medium text-pending-dark" data-testid="must-change">
          Welcome. Please choose your own password before you start.
        </p>
      ) : null}
      <Card className="p-5">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            names.submit(() => updateOwnName(fullName));
          }}
        >
          <h2 className="text-base font-semibold">Your name</h2>
          <Field label="Name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} required />
          </Field>
          <Button type="submit" disabled={names.pending || !fullName.trim()}>
            {names.pending ? "Saving…" : "Save name"}
          </Button>
        </form>
      </Card>
      <Card className="p-5">
        <form className="space-y-3" onSubmit={savePassword}>
          <h2 className="text-base font-semibold">Change your password</h2>
          <Field label={mustChange ? "Temporary password you were given" : "Current password"}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="New password (8 or more characters)">
            <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="Type the new password again">
            <Input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Change password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
