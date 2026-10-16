import { describe, expect, it } from "vitest";

import {
  checkPassword,
  createSessionToken,
  safeNextPath,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "./session";

const SECRET = "test-secret-value";
const ISSUED = new Date("2026-09-28T12:00:00Z");

describe("session tokens", () => {
  it("accepts a token it just made", async () => {
    const token = await createSessionToken(ISSUED, SECRET);

    expect(await verifySessionToken(token, ISSUED, SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(ISSUED, SECRET);

    expect(await verifySessionToken(token, ISSUED, "another-secret")).toBe(false);
  });

  it("rejects a tampered issue time or signature", async () => {
    const token = await createSessionToken(ISSUED, SECRET);
    const [issuedAt, signature] = token.split(".");

    expect(await verifySessionToken(`${Number(issuedAt) + 1}.${signature}`, ISSUED, SECRET)).toBe(false);
    expect(await verifySessionToken(`${issuedAt}.${signature}x`, ISSUED, SECRET)).toBe(false);
  });

  it("rejects a token older than its lifetime", async () => {
    const token = await createSessionToken(ISSUED, SECRET);
    const justInside = new Date(ISSUED.getTime() + SESSION_MAX_AGE_SECONDS * 1000 - 1000);
    const justOutside = new Date(ISSUED.getTime() + SESSION_MAX_AGE_SECONDS * 1000 + 1000);

    expect(await verifySessionToken(token, justInside, SECRET)).toBe(true);
    expect(await verifySessionToken(token, justOutside, SECRET)).toBe(false);
  });

  it.each([undefined, null, "", "noseparator", ".abc", "12.", "notdigits.abc"])(
    "rejects the malformed token %j",
    async (token) => {
      expect(await verifySessionToken(token, ISSUED, SECRET)).toBe(false);
    },
  );

  it("cannot make a token without a secret", async () => {
    await expect(createSessionToken(ISSUED, undefined)).rejects.toThrow(/AUTH_SECRET/);
  });

  it("verifies nothing when the secret is missing", async () => {
    const token = await createSessionToken(ISSUED, SECRET);

    expect(await verifySessionToken(token, ISSUED, undefined)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("accepts the exact password and rejects anything else", async () => {
    expect(await checkPassword("hunter2", "hunter2", SECRET)).toBe(true);
    expect(await checkPassword("Hunter2", "hunter2", SECRET)).toBe(false);
    expect(await checkPassword("hunter2 ", "hunter2", SECRET)).toBe(false);
  });

  it("refuses when the password or secret is not configured, or the input is empty", async () => {
    expect(await checkPassword("hunter2", undefined, SECRET)).toBe(false);
    expect(await checkPassword("hunter2", "hunter2", undefined)).toBe(false);
    expect(await checkPassword("", "hunter2", SECRET)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a local path", () => {
    expect(safeNextPath("/people?q=a")).toBe("/people?q=a");
    expect(safeNextPath("/segments/saved")).toBe("/segments/saved");
  });

  it.each([null, undefined, "", "people", "https://evil.com", "//evil.com", "/\\evil.com", "/\u0000bad"])(
    "falls back to home for %j",
    (next) => {
      expect(safeNextPath(next)).toBe("/");
    },
  );

  it("takes a custom fallback", () => {
    expect(safeNextPath("https://evil.com", "/login")).toBe("/login");
  });
});
