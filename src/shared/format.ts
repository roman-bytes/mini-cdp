/** Formats a count for display, e.g. 8441 -> "8,441". */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

const DATE_TIME_SECONDS_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

/** Formats a YYYY-MM-DD date for display, e.g. "Sep 28, 2026". */
export function formatDate(isoDate: string): string {
  return DATE_FORMAT.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Formats a moment for display in UTC, e.g. "Sep 28, 2026, 14:22 UTC". */
export function formatDateTime(date: Date): string {
  return `${DATE_TIME_FORMAT.format(date)} UTC`;
}

/** Formats a moment to the second, in UTC, for logs, e.g. "Sep 28, 2026, 14:22:05 UTC". */
export function formatDateTimeSeconds(date: Date): string {
  return `${DATE_TIME_SECONDS_FORMAT.format(date)} UTC`;
}

/** The first value of a query-string parameter, which may be repeated or missing. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A share as a whole-number percentage, e.g. (229, 899) -> "25%". Zero of zero is "0%". */
export function formatPercent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}

/** A YYYY-MM-DD date as a short label for an axis, e.g. "Jul 6". */
export function formatShortDate(isoDate: string): string {
  return formatDate(isoDate).replace(/, \d{4}$/, "");
}
