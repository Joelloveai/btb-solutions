import { getServerSession } from "next-auth";
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
        <div>
          {/* A plain link: the browser downloads the file from the authenticated /api/export route. */}
          <a href="/api/export" download className={linkButton("secondary")}>
            {t.exportAllData}
          </a>
        </div>
        <SignOutButton />
      </Card>
    </>
  );
}
