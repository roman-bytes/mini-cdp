/** How long something that just arrived stays highlighted: one hour. */
export const RECENT_WINDOW_MS = 60 * 60 * 1000;

/** Whether something arrived within the last hour, measured from `now` (milliseconds). */
export function isRecent(arrivedAt: Date, now: number): boolean {
  return now - arrivedAt.getTime() < RECENT_WINDOW_MS;
}

/**
 * The moment a server component draws its page, in milliseconds. Highlighted
 * rows are measured from it until the browser's own clock takes over.
 */
export function pageDrawnAt(): number {
  return Date.now();
}
