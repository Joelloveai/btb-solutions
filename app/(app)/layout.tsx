import { BottomNav, SideNav } from "@/components/nav";
import { LocaleProvider } from "@/components/locale-provider";
import { getLocale } from "@/lib/locale";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="flex flex-1">
        <SideNav />
        <div className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10 print:p-0">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
        <BottomNav />
      </div>
    </LocaleProvider>
  );
}
