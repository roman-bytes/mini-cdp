import { afterEach, beforeEach, vi } from "vitest";

/**
 * For tests: makes the clock read `moment` in every test of the surrounding
 * describe block. Only the date is frozen; timers still run normally.
 */
export function fixClockAt(moment: Date | number): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: moment });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
