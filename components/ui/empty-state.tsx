import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white px-6 py-10 text-center">
      <p className="text-base font-semibold text-gray-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">{hint}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
