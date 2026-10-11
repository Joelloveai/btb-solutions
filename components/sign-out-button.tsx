"use client";

import { useT } from "@/components/locale-provider";
import { useSafeSignOut } from "@/components/offline/use-safe-sign-out";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useT();
  const safeSignOut = useSafeSignOut();
  return (
    <Button variant="secondary" onClick={() => void safeSignOut("/login")}>
      {t.logout}
    </Button>
  );
}
