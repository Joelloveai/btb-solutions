import { BottomNav, SideNav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SideNav />
      <div className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </div>
      <BottomNav />
    </div>
  );
}
