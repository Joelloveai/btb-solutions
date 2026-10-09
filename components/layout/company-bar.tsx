import { COMPANY } from "@/lib/company-config";

/** Company trust strip: part of the app header, and shown alone on the login page. Hidden when printing. */
export function CompanyBar() {
  return (
    <div className="border-b-2 border-accent bg-brand text-white print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-4 px-4 py-1.5 text-[11px] leading-4 sm:text-xs lg:px-6">
        <p className="font-semibold tracking-wide">
          {COMPANY.name} — CIDB Grade {COMPANY.cidbGrade}
        </p>
        <p className="text-slate-300">CIDB Reg. No. {COMPANY.cidbRegNo}</p>
      </div>
    </div>
  );
}
