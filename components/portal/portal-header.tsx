"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Title bar for the client portal and the subcontractor page. Hidden when printing. */
export function PortalHeader({ title, home, signOutTo }: { title: string; home: string; signOutTo: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
      <Link href={home} className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-8 w-8" />
        <span className="font-semibold tracking-tight">{title}</span>
      </Link>
      <Button variant="ghost" small onClick={() => signOut({ callbackUrl: signOutTo })}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </Button>
    </div>
  );
}
