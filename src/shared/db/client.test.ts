import { afterEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb, isCloudflareWorker } from "./client";

describe("getDb", () => {
  afterEach(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });

  it("explains what to do when DATABASE_URL is missing", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getDb()).toThrow(/DATABASE_URL is not set/);
  });

  it("opens lazily: creating it does not need a reachable database", () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:1/none");

    expect(() => getDb()).not.toThrow();
  });

  it("opens a database per request on Cloudflare Workers", () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@localhost:1/none");
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });

    expect(isCloudflareWorker()).toBe(true);
    expect(() => getDb()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("isCloudflareWorker", () => {
  it("is false under Node", () => {
    expect(isCloudflareWorker()).toBe(false);
  });
});
