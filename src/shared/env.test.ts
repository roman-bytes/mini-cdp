import { describe, expect, it } from "vitest";

import { requireEnv } from "./env";

describe("requireEnv", () => {
  it("returns the value when it is set", () => {
    expect(requireEnv("DATABASE_URL", { DATABASE_URL: "postgres://x" })).toBe(
      "postgres://x",
    );
  });

  it("explains how to fix a missing value", () => {
    expect(() => requireEnv("DATABASE_URL", {})).toThrow(
      'DATABASE_URL is not set. Locally, copy .env.example to .env.local and fill it in; on Cloudflare, set it with "npx wrangler secret put DATABASE_URL".',
    );
  });

  it("treats an empty value as missing", () => {
    expect(() => requireEnv("DATABASE_URL", { DATABASE_URL: "" })).toThrow();
  });
});
