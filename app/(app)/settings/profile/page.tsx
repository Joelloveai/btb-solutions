import { getServerSession } from "next-auth";
import { ProfileForms } from "@/components/users/profile-forms";
import { PageHeader } from "@/components/ui/page-header";
import { authOptions } from "@/lib/auth";
import { ROLE_HELP, ROLE_LABELS, isStaffRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
  const role = isStaffRole(user?.role) ? user.role : "VIEWER";
  return (
    <>
      <PageHeader title="Your profile" description={`${user?.email ?? ""} · ${ROLE_LABELS[role]}: ${ROLE_HELP[role]}`} />
      <ProfileForms name={user?.name ?? ""} mustChange={!!user?.mustChangePassword} />
    </>
  );
}
