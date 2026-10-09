import clsx from "clsx";

const tones = {
  green: "bg-profit-light text-profit-dark",
  red: "bg-loss-light text-loss-dark",
  yellow: "bg-pending-light text-pending-dark",
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-brand-light text-brand",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof tones; children: string }) {
  return (
    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
