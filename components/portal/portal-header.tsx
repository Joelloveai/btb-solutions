"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useSafeSignOut } from "@/components/offline/use-safe-sign-out";
import { Button } from "@/components/ui/button";

/** Title bar for the client portal and the subcontractor page. Hidden when printing. */
export function PortalHeader({ title, home, signOutTo }: { title: string; home: string; signOutTo: string }) {
  const safeSignOut = useSafeSignOut();
  return (
    <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
      <Link href={home} className="flex min-h-12 items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-8 w-8" />
        <span className="font-semibold tracking-tight">{title}</span>
      </Link>
      <Button variant="ghost" small onClick={() => void safeSignOut(signOutTo)}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}
