"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptSubInvite } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PHOTO_TRADES } from "@/lib/constants";

export function JoinForm({ token, initialName, initialTrade, phone }: { token: string; initialName: string; initialTrade: string; phone: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // A trade already on file that is not in the list is kept as an extra choice.
  const trades = initialTrade && !(PHOTO_TRADES as readonly string[]).includes(initialTrade) ? [initialTrade, ...PHOTO_TRADES] : [...PHOTO_TRADES];

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    const result = await acceptSubInvite(token, { name: f.get("name"), trade: f.get("trade"), pin: f.get("pin"), pin2: f.get("pin2") });
    if (!result.ok) {
      setPending(false);
      return setError(result.error);
    }
    const signedIn = await signIn("sub-pin", { phone: result.data!.phone, pin: String(f.get("pin")), redirect: false });
    setPending(false);
    if (signedIn?.ok) {
      router.push("/sub/tasks");
      router.refresh();
    } else router.push("/login");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your phone number <span className="font-medium text-foreground">+{phone}</span> will be your login.
      </p>
      <Field label="Your name">
        <Input name="name" defaultValue={initialName} autoComplete="name" required />
      </Field>
      <Field label="Your trade">
        <Select name="trade" defaultValue={initialTrade}>
          <option value="">Choose…</option>
          {trades.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Choose a 6-digit PIN">
        <Input name="pin" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="new-password" required />
      </Field>
      <Field label="Type the PIN again">
        <Input name="pin2" type="password" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="new-password" required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Setting up…" : "Start"}
      </Button>
    </form>
  );
}
