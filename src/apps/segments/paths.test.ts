import { describe, expect, it } from "vitest";

import { SAVED_SEGMENTS_PATH, segmentExportPath, segmentPath } from "./paths";

describe("segment paths", () => {
  it("puts each saved segment under the saved segments page", () => {
    expect(SAVED_SEGMENTS_PATH).toBe("/segments/saved");
    expect(segmentPath("abc")).toBe("/segments/saved/abc");
    expect(segmentExportPath("abc")).toBe("/segments/saved/abc/export");
  });
});
