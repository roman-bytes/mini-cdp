import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "@/shared/db/client";
import { isUuid } from "@/shared/ids";

import { apiKeys } from "./schema";

const KEY_PREFIX = "cdp_";
const VISIBLE_PREFIX_LENGTH = 10;

/** A new random API key. It is shown once and never stored. */
export function generateApiKey(): string {
  return KEY_PREFIX + randomBytes(24).toString("base64url");
}

/** The form a key is stored in. A hash cannot be turned back into the key. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** The key from an "Authorization: Bearer <key>" header, or null. */
export function readBearerToken(header: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  return match ? match[1] : null;
}

/** Creates a key and returns it. This is the only time the key is readable. */
export async function createApiKey(db: Db, name: string) {
  const key = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      name: name.trim(),
      keyHash: hashApiKey(key),
      keyPrefix: key.slice(0, VISIBLE_PREFIX_LENGTH),
    })
    .returning({ id: apiKeys.id, name: apiKeys.name });
  return { ...row, key };
}

/** Every key, newest first, without anything that could be used to call the API. */
export async function listApiKeys(db: Db) {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));
}

/** Turns a key off. It stays in the list so its history is kept. */
export async function revokeApiKey(db: Db, id: string, now: Date = new Date()): Promise<void> {
  if (!isUuid(id)) return;
  await db
    .update(apiKeys)
    .set({ revokedAt: now })
    .where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
}

/**
 * Checks a presented key. Returns the key's ID when it is real and not
 * revoked, and records that it was used; returns null otherwise.
 */
export async function verifyApiKey(
  db: Db,
  key: string | null,
  now: Date = new Date(),
): Promise<string | null> {
  if (!key) return null;
  const [row] = await db
    .update(apiKeys)
    .set({ lastUsedAt: now })
    .where(and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return row?.id ?? null;
}
