"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/locale-provider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";
import { useSidebar } from "./sidebar-context";

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3 px-1" aria-label="BTB Solutions home">
      <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0" priority />
      {compact ? null : <span className="text-base font-semibold tracking-tight">BTB Solutions</span>}
    </Link>
  );
}

function NavList({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            title={compact ? t[item.label] : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
              compact && "justify-center px-0",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden="true" /> : null}
            <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-accent")} aria-hidden="true" />
            {compact ? <span className="sr-only">{t[item.label]}</span> : <span>{t[item.label]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop: fixed left rail that can collapse to icons. Phone: the same list in a drawer. */
export function AppSidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-card pb-4 pt-[var(--header-h)] transition-[width] duration-200 md:flex print:hidden",
          collapsed ? "w-[72px] px-3" : "w-64 px-4",
        )}
      >
        <div className={cn("mb-4 mt-5", collapsed && "flex justify-center")}>
          <Brand compact={collapsed} />
        </div>
        <NavList compact={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent className="p-4 print:hidden" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="mb-4 mt-1">
            <Brand />
          </div>
          <NavList onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
