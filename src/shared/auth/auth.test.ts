import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import {
  createApiKey,
  generateApiKey,
  hashApiKey,
  listApiKeys,
  readBearerToken,
  revokeApiKey,
  verifyApiKey,
} from "./api-keys";
import { consumeRateLimit, windowStartFor } from "./rate-limit";
import { apiKeys } from "./schema";

describe("generateApiKey", () => {
  it("makes a different, recognisable key each time", () => {
    const first = generateApiKey();

    expect(first).toMatch(/^cdp_[A-Za-z0-9_-]{32}$/);
    expect(generateApiKey()).not.toBe(first);
  });
});

describe("hashApiKey", () => {
  it("gives the same hash for the same key and never the key itself", () => {
    expect(hashApiKey("cdp_abc")).toBe(hashApiKey("cdp_abc"));
    expect(hashApiKey("cdp_abc")).not.toContain("cdp_abc");
    expect(hashApiKey("cdp_abc")).not.toBe(hashApiKey("cdp_abd"));
  });
});

describe("readBearerToken", () => {
  it("reads the key from a Bearer header", () => {
    expect(readBearerToken("Bearer cdp_abc")).toBe("cdp_abc");
    expect(readBearerToken("bearer   cdp_abc ")).toBe("cdp_abc");
  });

  it.each([null, "", "cdp_abc", "Basic abc", "Bearer", "Bearer a b"])("returns null for %j", (header) => {
    expect(readBearerToken(header)).toBeNull();
  });
});

describe("API keys in the database", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("stores only a hash and a short prefix of a new key", async () => {
    const created = await createApiKey(db, "  Mobile app ");
    const [stored] = await db.select().from(apiKeys);

    expect(created.name).toBe("Mobile app");
    expect(stored.keyHash).toBe(hashApiKey(created.key));
    expect(stored.keyPrefix).toBe(created.key.slice(0, 10));
    expect(JSON.stringify(stored)).not.toContain(created.key);
  });

  it("accepts a real key and records when it was used", async () => {
    const created = await createApiKey(db, "Mobile app");
    const usedAt = new Date("2026-09-28T14:00:00Z");

    expect(await verifyApiKey(db, created.key, usedAt)).toBe(created.id);
    expect((await listApiKeys(db))[0].lastUsedAt).toEqual(usedAt);
  });

  it("refuses a missing, wrong or revoked key", async () => {
    const created = await createApiKey(db, "Mobile app");

    expect(await verifyApiKey(db, null)).toBeNull();
    expect(await verifyApiKey(db, "cdp_wrong")).toBeNull();

    await revokeApiKey(db, created.id);
    expect(await verifyApiKey(db, created.key)).toBeNull();
  });

  it("keeps a revoked key in the list, marked as revoked, without its secret", async () => {
    const created = await createApiKey(db, "Mobile app");
    await revokeApiKey(db, created.id, new Date("2026-09-28T15:00:00Z"));
    const [listed] = await listApiKeys(db);

    expect(listed.revokedAt).toEqual(new Date("2026-09-28T15:00:00Z"));
    expect(listed).not.toHaveProperty("keyHash");
  });

  it("ignores a revoke for an ID that is not a key", async () => {
    await expect(revokeApiKey(db, "not-a-uuid")).resolves.toBeUndefined();
  });
});

describe("rate limiting", () => {
  let db: Db;
  const rule = { limit: 3, windowSeconds: 60 };
  const now = new Date("2026-09-28T14:00:30Z");

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("finds the start of the window a moment falls in", () => {
    expect(windowStartFor(now, 60)).toEqual(new Date("2026-09-28T14:00:00Z"));
  });

  it("allows requests up to the limit, then refuses", async () => {
    const results = [];
    for (let request = 0; request < 5; request += 1) {
      results.push(await consumeRateLimit(db, "key-1", rule, now));
    }

    expect(results).toEqual([true, true, true, false, false]);
  });

  it("counts each caller separately", async () => {
    for (let request = 0; request < 3; request += 1) await consumeRateLimit(db, "key-1", rule, now);

    expect(await consumeRateLimit(db, "key-1", rule, now)).toBe(false);
    expect(await consumeRateLimit(db, "key-2", rule, now)).toBe(true);
  });

  it("starts again in the next window", async () => {
    for (let request = 0; request < 4; request += 1) await consumeRateLimit(db, "key-1", rule, now);

    expect(await consumeRateLimit(db, "key-1", rule, new Date("2026-09-28T14:01:00Z"))).toBe(true);
  });
});
