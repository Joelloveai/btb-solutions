"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useT();
  return (
    <Button variant="secondary" onClick={() => signOut({ callbackUrl: "/login" })}>
      {t.logout}
    </Button>
  );
}
