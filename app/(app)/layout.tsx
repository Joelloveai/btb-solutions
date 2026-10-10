import { getServerSession } from "next-auth";
import { LocaleProvider } from "@/components/locale-provider";
import { AppShell } from "@/components/shell/app-shell";
import { redirect } from "next/navigation";
import { authOptions, homeFor, roleOf } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const session = await getServerSession(authOptions);
  // The middleware already routes by role; this keeps the staff area closed even if it were bypassed.
  const role = roleOf(session);
  if (role !== "staff") redirect(role ? homeFor(role) : "/login");
  return (
    <LocaleProvider locale={locale}>
      <AppShell email={session?.user?.email ?? ""}>{children}</AppShell>
    </LocaleProvider>
  );
}
