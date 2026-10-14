import { isIsoDate, toIsoDate } from "./dates";

/**
 * "Today" as YYYY-MM-DD for every time-based rule (segments, the assistant).
 * The assessment fixes it with CDP_TODAY=2026-09-28; with the setting unset
 * the real clock is used.
 */
export function getToday(configured: string | undefined = process.env.CDP_TODAY, now?: Date): string {
  // The clock is read only when nothing is configured.
  if (!configured) return toIsoDate(now ?? new Date());
  if (!isIsoDate(configured)) {
    throw new Error(`CDP_TODAY must be a YYYY-MM-DD date, got "${configured}"`);
  }
  return configured;
}
