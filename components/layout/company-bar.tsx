import { COMPANY } from "@/lib/company-config";

/** Trust bar shown at the top of every page, including login. Hidden when printing. */
export function CompanyBar() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-accent bg-brand text-white print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 px-4 py-1.5 text-xs md:px-8 md:text-sm">
        <p className="font-semibold">
          {COMPANY.name} — CIDB Grade {COMPANY.cidbGrade}
        </p>
        <p className="text-slate-300">CIDB Reg. No. {COMPANY.cidbRegNo}</p>
      </div>
    </header>
  );
}
