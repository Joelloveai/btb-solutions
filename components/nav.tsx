"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white md:block">
      <div className="p-5 text-lg font-bold text-brand">BTB Solutions</div>
      <nav aria-label="Main" className="space-y-1 px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "block rounded-lg px-3 py-2.5 font-medium",
              isActive(pathname, item.href)
                ? "bg-brand-light text-brand"
                : "text-gray-700 hover:bg-gray-100",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-gray-200 bg-white md:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(
            "flex h-16 items-center justify-center text-sm font-semibold",
            isActive(pathname, item.href) ? "text-brand" : "text-gray-600",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
