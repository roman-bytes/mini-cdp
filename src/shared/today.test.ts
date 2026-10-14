import { describe, expect, it } from "vitest";

import { getToday } from "./today";

describe("getToday", () => {
  it("uses the configured date when one is set", () => {
    expect(getToday("2026-09-28", new Date("2030-01-01T00:00:00Z"))).toBe(
      "2026-09-28",
    );
  });

  it("falls back to the real clock when nothing is configured", () => {
    expect(getToday(undefined, new Date("2030-01-01T12:00:00Z"))).toBe(
      "2030-01-01",
    );
    expect(getToday("", new Date("2030-01-01T12:00:00Z"))).toBe("2030-01-01");
  });

  it("refuses a configured value that is not a date", () => {
    expect(() => getToday("next tuesday")).toThrow(/CDP_TODAY/);
  });
});
