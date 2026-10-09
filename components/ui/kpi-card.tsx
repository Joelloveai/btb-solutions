import { Card, Metric, Text } from "@tremor/react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "profit" | "loss" | "pending";
const toneClass: Record<Tone, string> = {
  neutral: "text-foreground",
  profit: "text-profit",
  loss: "text-loss",
  pending: "text-pending",
};

/** Tremor KPI card. Colour is only ever a data state: green profit, red loss, amber pending. */
export function KpiCard({ label, value, tone = "neutral", hint, testId }: { label: string; value: string; tone?: Tone; hint?: string; testId?: string }) {
  return (
    <Card className="!rounded-xl !p-3 !ring-1 !ring-border !shadow-sm sm:!p-4">
      <Text className="!text-xs font-medium !text-muted-foreground">{label}</Text>
      <Metric className={cn("mt-1 whitespace-nowrap font-mono !text-sm !font-semibold tabular-nums sm:!text-xl lg:!text-2xl", toneClass[tone])} data-testid={testId}>
        {value}
      </Metric>
      {hint ? <Text className="mt-1 !text-xs !text-muted-foreground">{hint}</Text> : null}
    </Card>
  );
}
