"use client";

import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { useT } from "@/components/locale-provider";
import { useSafeSignOut } from "@/components/offline/use-safe-sign-out";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ email }: { email: string }) {
  const t = useT();
  const safeSignOut = useSafeSignOut();
  const initial = (email[0] ?? "?").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex h-12 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-[16rem] truncate">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Your profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" aria-hidden="true" />
            {t.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void safeSignOut("/login")}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
