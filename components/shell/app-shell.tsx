"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { MobileNav } from "./mobile-nav";
import { SidebarProvider, useSidebar } from "./sidebar-context";

function Frame({ email, children }: { email: string; children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    // --header-h is the height of the sticky header (trust strip + app bar): about 5.5rem on phones, 4.75rem from sm up.
    <div className="min-h-screen [--header-h:5.25rem] sm:[--header-h:4.75rem] print:min-h-0">
      <AppHeader email={email} />
      <AppSidebar />
      <main
        className={cn(
          "px-4 pb-28 pt-5 transition-[padding] duration-200 md:pb-10 lg:px-6 print:m-0 print:p-0",
          collapsed ? "md:ml-[72px]" : "md:ml-64",
        )}
      >
        <div className="mx-auto max-w-[1400px] print:max-w-none">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}

/** The app shell (ported from TailAdmin's layout): sidebar, sticky header, content, phone bottom bar. */
export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <SidebarProvider>
      <Frame email={email}>{children}</Frame>
    </SidebarProvider>
  );
}
