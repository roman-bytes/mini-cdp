import { describe, expect, it } from "vitest";

import { fileLineNumber, loaded, merged, setAside } from "./outcomes";

describe("row results", () => {
  it("builds a loaded result with no reason", () => {
    expect(loaded()).toEqual({ outcome: "loaded", reason: null });
  });

  it("builds a merged result that keeps its reason", () => {
    expect(merged("Duplicate of line 2")).toEqual({
      outcome: "merged",
      reason: "Duplicate of line 2",
    });
  });

  it("builds a set-aside result that keeps its reason", () => {
    expect(setAside("Blank row")).toEqual({
      outcome: "set_aside",
      reason: "Blank row",
    });
  });
});

describe("fileLineNumber", () => {
  it("counts the header as line 1", () => {
    expect(fileLineNumber(0)).toBe(2);
    expect(fileLineNumber(9)).toBe(11);
  });
});
