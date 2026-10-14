import { useSyncExternalStore } from "react";

/** How often the clock moves on. A highlight may end up to this much late. */
export const CLOCK_TICK_MS = 30_000;

function subscribe(onTick: () => void): () => void {
  const timer = setInterval(onTick, CLOCK_TICK_MS);
  return () => clearInterval(timer);
}

/** The time now, rounded down to the tick, so it stays the same between ticks. */
function currentTick(): number {
  return Math.floor(Date.now() / CLOCK_TICK_MS) * CLOCK_TICK_MS;
}

/**
 * The current time in milliseconds, kept up to date while the page is open.
 * Until the page is running in the browser it is `serverNow`, the time the
 * server drew the page at, so the server's HTML and the browser's first draw
 * agree.
 */
export function useNow(serverNow: number): number {
  return useSyncExternalStore(subscribe, currentTick, () => serverNow);
}
