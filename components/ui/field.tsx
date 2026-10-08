import clsx from "clsx";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

const control =
  "h-12 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={clsx(control, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={clsx(control, className)} {...props} />;
  },
);
