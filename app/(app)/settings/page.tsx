import { getServerSession } from "next-auth";
import Link from "next/link";
import { can } from "@/lib/permissions";
import { LanguageToggle } from "@/components/language-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { linkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { authOptions } from "@/lib/auth";
import { getT } from "@/lib/locale";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const { locale, t } = await getT();
  return (
    <>
      <PageHeader title={t.settings} />
      <Card className="max-w-xl space-y-5 p-5">
        <div>
          <p className="text-sm text-muted-foreground">Signed in as</p>
          <p className="font-semibold">{session?.user?.email}</p>
        </div>
        <LanguageToggle current={locale} />
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/profile" className={linkButton("secondary")}>
            Your profile
          </Link>
          {can(session?.user?.staffRole, "users.manage") ? (
            <Link href="/settings/users" className={linkButton("secondary")}>
              Users
            </Link>
          ) : null}
        </div>
        {can(session?.user?.staffRole, "financials.view") ? (
          <div>
            {/* A plain link: the browser downloads the file from the authenticated /api/export route. */}
            <a href="/api/export" download className={linkButton("secondary")}>
              {t.exportAllData}
            </a>
          </div>
        ) : null}
        <SignOutButton />
      </Card>
    </>
  );
}
