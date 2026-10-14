import { describe, expect, it } from "vitest";

import { fixClockAt } from "./fixed-clock";
import { isRecent, pageDrawnAt, RECENT_WINDOW_MS } from "./recent";

describe("isRecent", () => {
  const now = new Date("2026-09-28T15:00:00Z").getTime();

  it("is true for something that arrived within the last hour", () => {
    expect(isRecent(new Date("2026-09-28T15:00:00Z"), now)).toBe(true);
    expect(isRecent(new Date("2026-09-28T14:00:01Z"), now)).toBe(true);
  });

  it("is false once a full hour has passed", () => {
    expect(isRecent(new Date("2026-09-28T14:00:00Z"), now)).toBe(false);
    expect(isRecent(new Date("2026-09-27T15:00:00Z"), now)).toBe(false);
  });

  it("uses a one-hour window", () => {
    expect(RECENT_WINDOW_MS).toBe(3_600_000);
  });
});

describe("pageDrawnAt", () => {
  fixClockAt(new Date("2026-09-28T15:00:00Z"));

  it("is the time now, in milliseconds", () => {
    expect(pageDrawnAt()).toBe(new Date("2026-09-28T15:00:00Z").getTime());
  });
});
