const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toIsoDate(date) === value;
}

/** The YYYY-MM-DD part of a date, in UTC. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parses "YYYY-MM-DD HH:MM:SS". The source files carry no timezone, so the
 * value is read as UTC. Returns null when the text is not a real timestamp.
 */
export function parseUtcTimestamp(value: string): Date | null {
  const match = TIMESTAMP_PATTERN.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
