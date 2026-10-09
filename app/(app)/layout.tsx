import { getServerSession } from "next-auth";
import { LocaleProvider } from "@/components/locale-provider";
import { AppShell } from "@/components/shell/app-shell";
import { authOptions } from "@/lib/auth";
import { getLocale } from "@/lib/locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const session = await getServerSession(authOptions);
  return (
    <LocaleProvider locale={locale}>
      <AppShell email={session?.user?.email ?? ""}>{children}</AppShell>
    </LocaleProvider>
  );
}
