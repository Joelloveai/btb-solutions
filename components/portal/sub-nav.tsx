"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/sub/tasks", label: "Tasks" },
  { href: "/sub/punch", label: "Punch list" },
  { href: "/sub/drawings", label: "Drawings" },
];

/** The subcontractor's few screens. Big, plain links. */
export function SubNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Subcontractor" className="mb-4 grid gap-2 print:hidden" style={{ gridTemplateColumns: `repeat(${LINKS.length}, minmax(0, 1fr))` }}>
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-12 items-center justify-center rounded-lg border text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
