"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { homeFor } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"email" | "pin">("email");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result =
      mode === "pin"
        ? await signIn("sub-pin", { phone: String(form.get("phone")), pin: String(form.get("pin")), redirect: false })
        : await signIn("credentials", {
            email: String(form.get("email")),
            password: String(form.get("password")),
            redirect: false,
          });
    setPending(false);
    if (result?.ok) {
      // Staff go to the dashboard; a subcontractor signing in here goes to their task list.
      const session = await getSession();
      router.push(homeFor(session?.user?.role ?? "staff"));
      router.refresh();
    } else if (mode === "pin") {
      toast.error(result?.error === "LOCKED" ? "Too many tries. Please wait 15 minutes, then try again." : "Wrong phone number or PIN");
    } else {
      toast.error("Wrong email or password");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit}>
          <CardHeader className="items-center space-y-2 p-6 pb-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="BTB Solutions" className="h-12 w-12" />
            <h1 className="text-xl font-semibold tracking-tight">BTB Solutions</h1>
            <p className="text-sm text-muted-foreground">Sign in to track your jobs</p>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-2">
            {mode === "email" ? (
              <>
                <Field label="Email">
                  <Input name="email" type="email" autoComplete="email" required />
                </Field>
                <Field label="Password">
                  <Input name="password" type="password" autoComplete="current-password" required />
                </Field>
              </>
            ) : (
              <>
                <Field label="Phone number">
                  <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="012-345 6789" required />
                </Field>
                <Field label="6-digit PIN">
                  <Input name="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" required />
                </Field>
              </>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setMode(mode === "email" ? "pin" : "email")}>
              {mode === "email" ? "Subcontractor? Use phone and PIN" : "Use email instead"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </main>
  );
}
