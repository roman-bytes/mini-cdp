import { describe, expect, it } from "vitest";

import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts a UUID in either case", () => {
    expect(isUuid("3f6972bf-3046-4a1b-a662-47e26413d514")).toBe(true);
    expect(isUuid("3F6972BF-3046-4A1B-A662-47E26413D514")).toBe(true);
  });

  it.each(["", "abc", "3f6972bf-3046-4a1b-a662", "'; drop table people; --"])("rejects %j", (value) => {
    expect(isUuid(value)).toBe(false);
  });
});
