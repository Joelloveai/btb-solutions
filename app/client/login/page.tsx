"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

export default function ClientLoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await signIn("client-credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setPending(false);
    if (result?.ok) {
      router.push("/client/projects");
      router.refresh();
    } else {
      toast.error("Wrong email or password");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center py-8">
      <Card className="w-full max-w-sm">
        <form onSubmit={onSubmit}>
          <CardHeader className="items-center space-y-2 p-6 pb-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="BTB Builders" className="h-12 w-12" />
            <h1 className="text-xl font-semibold tracking-tight">Client portal</h1>
            <p className="text-sm text-muted-foreground">Sign in to follow your project</p>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-2">
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </main>
  );
}
