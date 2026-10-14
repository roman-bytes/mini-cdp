import { describe, expect, it } from "vitest";

import {
  firstParam,
  formatDate,
  formatDateTime,
  formatDateTimeSeconds,
  formatNumber,
  formatPercent,
  formatShortDate,
} from "./format";

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(8441)).toBe("8,441");
    expect(formatNumber(10000)).toBe("10,000");
  });

  it("leaves small numbers alone", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(85)).toBe("85");
  });
});

describe("formatDate", () => {
  it("writes a date out in words", () => {
    expect(formatDate("2026-09-28")).toBe("Sep 28, 2026");
  });
});

describe("formatDateTimeSeconds", () => {
  it("shows the date and the time to the second, in UTC", () => {
    expect(formatDateTimeSeconds(new Date("2026-09-28T14:22:05Z"))).toBe("Sep 28, 2026, 14:22:05 UTC");
    expect(formatDateTimeSeconds(new Date("2026-09-28T00:00:09Z"))).toBe("Sep 28, 2026, 00:00:09 UTC");
  });
});

describe("formatDateTime", () => {
  it("shows the moment in UTC on a 24-hour clock", () => {
    expect(formatDateTime(new Date("2026-09-28T14:22:05Z"))).toBe("Sep 28, 2026, 14:22 UTC");
    expect(formatDateTime(new Date("2026-09-28T00:05:00Z"))).toBe("Sep 28, 2026, 00:05 UTC");
  });
});

describe("firstParam", () => {
  it("returns a single value, the first of several, or undefined", () => {
    expect(firstParam("a")).toBe("a");
    expect(firstParam(["a", "b"])).toBe("a");
    expect(firstParam(undefined)).toBeUndefined();
  });
});

describe("formatPercent", () => {
  it("rounds to a whole percentage", () => {
    expect(formatPercent(229, 899)).toBe("25%");
    expect(formatPercent(2166, 2900)).toBe("75%");
  });

  it("treats zero of zero as 0%", () => {
    expect(formatPercent(0, 0)).toBe("0%");
  });
});

describe("formatShortDate", () => {
  it("drops the year", () => {
    expect(formatShortDate("2026-07-06")).toBe("Jul 6");
  });
});
