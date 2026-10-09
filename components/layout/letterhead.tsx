import { COMPANY } from "@/lib/company-config";

/** Company letterhead printed at the top of quotes, claims and letters. */
export function Letterhead() {
  return (
    <header className="border-b-2 border-brand pb-3">
      <h1 className="text-xl font-bold">{COMPANY.name}</h1>
      <p className="text-sm text-muted-foreground">
        CIDB Grade {COMPANY.cidbGrade} · CIDB Reg. No. {COMPANY.cidbRegNo}
      </p>
      {COMPANY.addressLines.map((line) => (
        <p key={line} className="text-sm text-muted-foreground">
          {line}
        </p>
      ))}
    </header>
  );
}
