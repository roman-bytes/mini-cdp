import { toIsoDate } from "./dates";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The YYYY-MM-DD date that is `days` days before `isoDate`. */
export function daysBefore(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return toIsoDate(new Date(date.getTime() - days * MS_PER_DAY));
}

/** Whole days from `earlier` to `later`, both YYYY-MM-DD. */
export function daysBetween(earlier: string, later: string): number {
  const start = new Date(`${earlier}T00:00:00Z`).getTime();
  const end = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

/** The Monday on or before a YYYY-MM-DD date. Weeks start on Monday, as in Postgres. */
export function startOfWeek(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // Sunday is 0
  return daysBefore(isoDate, (day + 6) % 7);
}
