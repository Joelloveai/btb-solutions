import { getServerSession } from "next-auth";
import { CompanyBar } from "@/components/layout/company-bar";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { authOptions } from "@/lib/auth";

// The subcontractor page is a small phone-first shell: company strip, then the task list.
export default async function SubLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <OfflineProvider userKey={`sub:${session?.user?.id ?? "unknown"}`} warmUrls={["/sub/tasks"]}>
      <div className="flex min-h-screen flex-col bg-background print:min-h-0 print:bg-white">
        <div className="print:hidden">
          <CompanyBar />
          <OfflineIndicator />
        </div>
        <div className="mx-auto w-full max-w-xl flex-1 px-4 py-5">{children}</div>
      </div>
    </OfflineProvider>
  );
}
