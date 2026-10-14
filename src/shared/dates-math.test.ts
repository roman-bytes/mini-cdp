import { describe, expect, it } from "vitest";

import { daysBefore, daysBetween, startOfWeek } from "./dates-math";

describe("daysBefore", () => {
  it("steps back across a month boundary", () => {
    expect(daysBefore("2026-09-28", 30)).toBe("2026-08-29");
  });

  it("returns the same day for zero days", () => {
    expect(daysBefore("2026-09-28", 0)).toBe("2026-09-28");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-08-29", "2026-09-28")).toBe(30);
    expect(daysBetween("2026-09-28", "2026-09-28")).toBe(0);
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the week", () => {
    expect(startOfWeek("2026-07-01")).toBe("2026-06-29"); // a Wednesday
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21"); // a Sunday
  });

  it("returns the date itself for a Monday", () => {
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
  });
});
