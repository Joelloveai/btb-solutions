import { CompanyBar } from "@/components/layout/company-bar";

// Login is its own minimal layout: the company trust strip, then a centred card. No app shell.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <CompanyBar />
      {children}
    </div>
  );
}
