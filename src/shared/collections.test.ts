import { describe, expect, it } from "vitest";

import { chunk, unique } from "./collections";

describe("chunk", () => {
  it("splits a list into pieces of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no pieces for an empty list", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("refuses a size below 1", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("unique", () => {
  it("drops repeats and keeps first-seen order", () => {
    expect(unique(["b", "a", "b", "c", "a"])).toEqual(["b", "a", "c"]);
  });
});
