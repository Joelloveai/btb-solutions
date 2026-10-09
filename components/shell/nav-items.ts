import { Contact, FileText, HardHat, LayoutDashboard, Receipt, Settings, Wrench, type LucideIcon } from "lucide-react";
import type { Translations } from "@/lib/i18n";

export type NavItem = { href: string; label: keyof Translations; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", icon: LayoutDashboard },
  { href: "/quotes", label: "quotes", icon: FileText },
  { href: "/projects", label: "projects", icon: HardHat },
  { href: "/receivables", label: "receivables", icon: Receipt },
  { href: "/subcons", label: "subcons", icon: Wrench },
  { href: "/clients", label: "clients", icon: Contact },
  { href: "/settings", label: "settings", icon: Settings },
];

/** The four screens used most on site; the rest sit behind "More" on phones. */
export const PRIMARY_MOBILE = ["/dashboard", "/quotes", "/projects", "/receivables"];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
