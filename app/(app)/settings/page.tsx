import { getServerSession } from "next-auth";
import { LanguageToggle } from "@/components/language-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { getT } from "@/lib/locale";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const { locale, t } = await getT();
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">{t.settings}</h1>
      <div className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="font-semibold">{session?.user?.email}</p>
        </div>
        <LanguageToggle current={locale} />
        <div>
          {/* A plain link: the browser downloads the file from the authenticated /api/export route. */}
          <a
            href="/api/export"
            download
            className="inline-flex h-12 items-center rounded-lg border border-slate-300 bg-white px-5 text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            {t.exportAllData}
          </a>
        </div>
        <SignOutButton />
      </div>
    </>
  );
}
