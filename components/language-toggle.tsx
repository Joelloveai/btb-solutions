"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { setLocale } from "@/app/actions";
import { useT } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ms", label: "Bahasa Melayu" },
];

export function LanguageToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    startTransition(async () => {
      const result = await setLocale(locale);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  };

  return (
    <div>
      <p className="mb-1 text-sm text-slate-500">{t.language}</p>
      <div role="group" aria-label={t.language} className="grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={current === o.value}
            disabled={pending}
            onClick={() => choose(o.value)}
            className={clsx(
              "h-11 rounded-lg text-sm font-semibold",
              current === o.value ? "bg-white text-brand shadow" : "text-slate-600",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
