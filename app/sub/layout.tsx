import { CompanyBar } from "@/components/layout/company-bar";

// The subcontractor page is a small phone-first shell: company strip, then the task list.
export default function SubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background print:min-h-0 print:bg-white">
      <CompanyBar />
      <div className="mx-auto w-full max-w-xl flex-1 px-4 py-5">{children}</div>
    </div>
  );
}
