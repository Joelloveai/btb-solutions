import { Contact, FileText, HardHat, LayoutDashboard, Receipt, Settings, Users, Wrench, type LucideIcon } from "lucide-react";
import type { Capability } from "@/lib/permissions";
import type { Translations } from "@/lib/i18n";

export type NavItem = { href: string; label: keyof Translations; icon: LucideIcon; /** Who sees this link; everyone when empty. */ requires?: Capability };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "dashboard", icon: LayoutDashboard, requires: "financials.view" },
  { href: "/quotes", label: "quotes", icon: FileText, requires: "financials.view" },
  { href: "/projects", label: "projects", icon: HardHat },
  { href: "/receivables", label: "receivables", icon: Receipt, requires: "financials.view" },
  { href: "/subcons", label: "subcons", icon: Wrench, requires: "financials.view" },
  { href: "/clients", label: "clients", icon: Contact, requires: "financials.view" },
  { href: "/settings/users", label: "users", icon: Users, requires: "users.manage" },
  { href: "/settings", label: "settings", icon: Settings },
];

/** The four screens used most on site; the rest sit behind "More" on phones. */
export const PRIMARY_MOBILE = ["/dashboard", "/quotes", "/projects", "/receivables"];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
