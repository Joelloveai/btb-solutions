import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-gray-700 hover:bg-gray-100",
};

export function Button({
  variant = "primary",
  small = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50",
        small ? "h-9 px-3 text-sm" : "h-12 px-5 text-base",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
