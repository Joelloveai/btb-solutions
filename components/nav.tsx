"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/components/locale-provider";
import type { Translations } from "@/lib/i18n";

const items: { href: string; label: keyof Translations }[] = [
  { href: "/dashboard", label: "dashboard" },
  { href: "/quotes", label: "quotes" },
  { href: "/projects", label: "projects" },
  { href: "/receivables", label: "receivables" },
  { href: "/subcons", label: "subcons" },
  { href: "/clients", label: "clients" },
  { href: "/settings", label: "settings" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block print:hidden">
      <div className="p-5 text-lg font-bold text-brand">BTB Solutions</div>
      <nav aria-label="Main" className="space-y-1 px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "block rounded-lg border-l-4 px-3 py-2.5 font-medium",
              isActive(pathname, item.href)
                ? "border-accent bg-brand-light/60 text-brand"
                : "border-transparent text-slate-700 hover:bg-slate-100",
            )}
          >
            {t[item.label]}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white md:hidden print:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(
            "flex h-16 min-w-[5.5rem] flex-1 items-center justify-center whitespace-nowrap border-t-2 px-2 text-sm font-semibold",
            isActive(pathname, item.href) ? "border-accent text-brand" : "border-transparent text-slate-600",
          )}
        >
          {t[item.label]}
        </Link>
      ))}
    </nav>
  );
}
