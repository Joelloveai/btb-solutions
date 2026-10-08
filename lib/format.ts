const numberFormat = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a number as `RM 1,234.56`; negatives become `-RM 1,234.56`. */
export function formatRM(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = numberFormat.format(Math.abs(rounded));
  return `${rounded < 0 ? "-" : ""}RM ${text}`;
}

/** Dates are stored at UTC midnight, so they must be shown in UTC to avoid a one-day shift. */
export function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-MY", {
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
