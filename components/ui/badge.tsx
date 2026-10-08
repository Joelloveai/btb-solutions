import clsx from "clsx";

const tones = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  yellow: "bg-amber-100 text-amber-800",
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-brand-light text-brand",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof tones; children: string }) {
  return (
    <span className={clsx("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
