import { getServerSession } from "next-auth";
import { LocaleProvider } from "@/components/locale-provider";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { CaptureFab } from "@/components/capture/capture-fab";
import { AppShell } from "@/components/shell/app-shell";
import { redirect } from "next/navigation";
import { authOptions, homeFor, roleOf } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const session = await getServerSession(authOptions);
  // The middleware already routes by role; this keeps the staff area closed even if it were bypassed.
  const role = roleOf(session);
  if (role !== "staff") redirect(role ? homeFor(role) : "/login");
  // Pages worth having on the phone before the signal drops: the main screens and the busiest projects.
  const recent = await prisma.project.findMany({ select: { id: true }, orderBy: { updatedAt: "desc" }, take: 12 });
  const captureProjects = await prisma.project.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 40 });
  const warmUrls = ["/dashboard", "/projects", "/quotes", "/receivables", "/subcons", "/clients", ...recent.map((p) => `/projects/${p.id}`)];
  return (
    <LocaleProvider locale={locale}>
      <OfflineProvider userKey={session?.user?.email ?? "staff"} warmUrls={warmUrls}>
        <AppShell email={session?.user?.email ?? ""}>{children}</AppShell>
        <CaptureFab role="staff" projects={captureProjects} />
      </OfflineProvider>
    </LocaleProvider>
  );
}
