import { describe, expect, it } from "vitest";

import { formatNumber } from "./format";

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
