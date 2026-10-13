import { Card } from "@/components/ui/card";
import { formatDate, formatRM } from "@/lib/format";
import type { RetentionReport } from "@/lib/retention";

/** What has been held back on each claim, the running total, what has come back, and when the rest is due. */
export function RetentionTracker({ report }: { report: RetentionReport }) {
  if (report.rows.length === 0) return null;
  return (
    <Card className="mb-5 space-y-3 p-4" role="region" aria-label="Retention tracker">
      <h2 className="text-base font-semibold">Retention tracker</h2>
      {report.alert ? (
        <p role="status" className="rounded-lg bg-pending-light px-3 py-2 text-sm font-medium text-pending-dark" data-testid="retention-alert">
          {report.alert}
        </p>
      ) : null}
      <ul className="text-sm" data-testid="retention-rows" aria-label="Retention held per claim">
        <li className="grid grid-cols-3 gap-2 border-b py-1 text-xs text-muted-foreground">
          <span>Claim</span>
          <span className="text-right">Held on this claim</span>
          <span className="text-right">Total held</span>
        </li>
        {report.rows.map((r) => (
          <li key={r.number} className="grid grid-cols-3 gap-2 border-b py-2">
            <span>Claim {r.number}</span>
            <span className="text-right font-mono tabular-nums">{formatRM(r.held)}</span>
            <span className="text-right font-mono tabular-nums">{formatRM(r.cumulative)}</span>
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Held</dt>
          <dd className="font-mono font-semibold" data-testid="tracker-held">{formatRM(report.held)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Released</dt>
          <dd className="font-mono font-semibold" data-testid="tracker-released">{formatRM(report.released)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Still outstanding</dt>
          <dd className="font-mono font-semibold text-pending-dark" data-testid="tracker-outstanding">{formatRM(report.outstanding)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        {report.firstRelease.dueDate
          ? `First release of ${formatRM(report.firstRelease.amount)} at completion, ${formatDate(report.firstRelease.dueDate)}. The rest ${report.finalRelease.dueDate ? `after the defects liability period, ${formatDate(report.finalRelease.dueDate)}` : "after the defects liability period"}.`
          : "Set the contract end date on the Contract tab to see when retention falls due."}
      </p>
    </Card>
  );
}
