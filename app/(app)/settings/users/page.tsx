import { UsersPanel } from "@/components/users/users-panel";
import { PageHeader } from "@/components/ui/page-header";
import { authOptions } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { requireAdminPage } from "@/lib/guards";
import { getLocale } from "@/lib/locale";
import { isStaffRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";

/** The people who sign in to the office app. Admins only. */
export default async function UsersPage() {
  await requireAdminPage();
  const locale = await getLocale();
  const me = (await getServerSession(authOptions))?.user?.id;
  const users = await prisma.user.findMany({ where: { subcontractorId: null }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  return (
    <>
      <PageHeader title="Users" description="Everyone who can sign in to the office app. Subcontractors and clients are managed from their own pages." />
      <UsersPanel
        rows={users.map((u) => ({
          id: u.id,
          name: u.name ?? "(no name)",
          email: u.email,
          role: isStaffRole(u.role) ? u.role : "VIEWER",
          active: u.isActive,
          lastLoginText: u.lastLoginAt ? formatDateTime(u.lastLoginAt, locale) : "Never",
          mustChange: u.mustChangePassword,
          isMe: u.id === me,
        }))}
      />
    </>
  );
}
