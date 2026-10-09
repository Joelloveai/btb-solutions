import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Semantic colours (green/red/amber/orange) mean a data state; navy and grey are neutral.
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-4",
  {
    variants: {
      tone: {
        green: "border-profit/20 bg-profit-light text-profit-dark",
        red: "border-loss/20 bg-loss-light text-loss-dark",
        yellow: "border-pending/25 bg-pending-light text-pending-dark",
        orange: "border-orange-300/60 bg-orange-50 text-orange-800",
        gray: "border-slate-200 bg-slate-100 text-slate-700",
        blue: "border-slate-300 bg-slate-100 text-slate-900",
      },
    },
    defaultVariants: { tone: "gray" },
  },
);

type Tone = NonNullable<Parameters<typeof badgeVariants>[0]>["tone"];

export function Badge({ tone, children, className }: { tone: Tone; children: string; className?: string }) {
  return <span className={cn(badgeVariants({ tone }), className)}>{children}</span>;
}

export { badgeVariants };
