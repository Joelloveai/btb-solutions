import type { Locale } from "./i18n";

const intlLocale = (locale: Locale) => (locale === "ms" ? "ms-MY" : "en-MY");

const numberFormats: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(intlLocale("en"), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ms: new Intl.NumberFormat(intlLocale("ms"), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

/** Formats a number as `RM 1,234.56`; negatives become `-RM 1,234.56`. */
export function formatRM(value: number, locale: Locale = "en"): string {
  const rounded = Math.round(value * 100) / 100;
  const text = numberFormats[locale].format(Math.abs(rounded));
  return `${rounded < 0 ? "-" : ""}RM ${text}`;
}

/** Dates are stored at UTC midnight, so they must be shown in UTC to avoid a one-day shift. */
export function formatDate(value: Date | string, locale: Locale = "en"): string {
  return new Date(value).toLocaleDateString(intlLocale(locale), {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Today's calendar date in Malaysia (UTC+8) as a UTC-midnight Date, ready for `formatDate`. */
export function todayInMalaysia(): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Date and time for things that happen at a moment (photos, completions), in Malaysia time. */
export function formatDateTime(value: Date | string, locale: Locale = "en"): string {
  return new Date(value).toLocaleString(intlLocale(locale), {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
