import { CompanyBar } from "@/components/layout/company-bar";

// The client portal is its own small shell: company trust strip, then the page. No staff navigation.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background print:min-h-0 print:bg-white">
      <CompanyBar />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}
