import { describe, expect, it } from "vitest";

import { isIsoDate, parseUtcTimestamp, toIsoDate } from "./dates";

describe("isIsoDate", () => {
  it("accepts a real date", () => {
    expect(isIsoDate("2026-09-28")).toBe(true);
  });

  it.each(["", "2026-9-28", "09/28/2026", "2026-02-30", "2026-13-01", "today"])(
    "rejects %j",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

describe("toIsoDate", () => {
  it("returns the UTC calendar date", () => {
    expect(toIsoDate(new Date("2026-09-28T23:59:59Z"))).toBe("2026-09-28");
  });
});

describe("parseUtcTimestamp", () => {
  it("reads a timestamp with no timezone as UTC", () => {
    const parsed = parseUtcTimestamp("2026-06-30 20:11:42");
    expect(parsed?.toISOString()).toBe("2026-06-30T20:11:42.000Z");
  });

  it("accepts a T between the date and the time", () => {
    const parsed = parseUtcTimestamp("2026-06-30T20:11:42");
    expect(parsed?.toISOString()).toBe("2026-06-30T20:11:42.000Z");
  });

  it.each(["", "2026-06-30", "not a time", "2026-13-40 99:99:99"])(
    "returns null for %j",
    (value) => {
      expect(parseUtcTimestamp(value)).toBeNull();
    },
  );
});
