import { getServerSession } from "next-auth";
import { CompanyBar } from "@/components/layout/company-bar";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { authOptions } from "@/lib/auth";

// The client portal is its own small shell: company trust strip, then the page. No staff navigation.
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const shell = (
    <div className="flex min-h-screen flex-col bg-background print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <CompanyBar />
        <OfflineIndicator />
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
  // Nobody signed in (the login page): nothing to keep on the device.
  if (!session?.user?.id) return shell;
  return (
    <OfflineProvider userKey={`client:${session.user.id}`} warmUrls={["/client/projects"]}>
      {shell}
    </OfflineProvider>
  );
}
