import { describe, expect, it } from "vitest";

import { channelLabel, normalizeChannel } from "./channels";

describe("normalizeChannel", () => {
  it("lowercases a newsletter source", () => {
    expect(normalizeChannel("Instagram")).toBe("instagram");
  });

  it("treats X and twitter as one channel", () => {
    expect(normalizeChannel("X")).toBe("x");
    expect(normalizeChannel("twitter")).toBe("x");
  });

  it("returns null when there is no channel", () => {
    expect(normalizeChannel("")).toBeNull();
    expect(normalizeChannel("   ")).toBeNull();
  });

  it("keeps a channel it has not seen before", () => {
    expect(normalizeChannel("TikTok")).toBe("tiktok");
  });
});

describe("channelLabel", () => {
  it("returns the display name", () => {
    expect(channelLabel("x")).toBe("X");
    expect(channelLabel("instagram")).toBe("Instagram");
  });

  it("falls back to the stored value for an unknown channel", () => {
    expect(channelLabel("tiktok")).toBe("tiktok");
  });
});
