"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { CompanyBar } from "@/components/layout/company-bar";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { Button } from "@/components/ui/button";
import { useSidebar } from "./sidebar-context";
import { UserMenu } from "./user-menu";

/** Sticky header: company trust strip on top, app bar (menu toggle, account) below. */
export function AppHeader({ email }: { email: string }) {
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();
  return (
    <header className="sticky top-0 z-40 print:hidden">
      <CompanyBar />
      <div className="flex h-12 items-center justify-between border-b bg-card px-3 lg:px-6">
        <div className="flex items-center gap-1">
          <Button variant="ghost" small className="h-10 w-10 px-0 md:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            small
            className="hidden h-10 w-10 px-0 md:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </div>
        <UserMenu email={email} />
      </div>
      <OfflineIndicator />
    </header>
  );
}
