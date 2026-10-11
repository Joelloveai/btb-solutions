"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/locale-provider";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, PRIMARY_MOBILE, isActive } from "./nav-items";
import { useSidebar } from "./sidebar-context";

/** Thumb-reach bar for phones: the four main screens, then "More" for the rest. */
export function MobileNav() {
  const pathname = usePathname();
  const t = useT();
  const { setMobileOpen } = useSidebar();
  const items = NAV_ITEMS.filter((item) => PRIMARY_MOBILE.includes(item.href));
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-2 border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 rounded-md border-t-2 text-[11px] font-medium",
              active ? "border-accent text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {t[item.label]}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex h-16 flex-col items-center justify-center gap-1 border-t-2 border-transparent text-[11px] font-medium text-muted-foreground"
      >
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
        More
      </button>
    </nav>
  );
}
