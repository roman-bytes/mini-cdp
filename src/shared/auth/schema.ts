import { integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Auth owns the credentials machines use to call the app. */
export const authSchema = pgSchema("auth");

/**
 * One row per API key. Only a hash of the key is stored, so a copy of the
 * database cannot be used to call the webhook.
 */
export const apiKeys = authSchema.table("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  /** The first characters of the key, shown so a key can be recognised. */
  keyPrefix: text("key_prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

/** How many requests a caller has made in each time window. */
export const rateLimits = authSchema.table(
  "rate_limits",
  {
    /** Who is being counted, e.g. an API key ID. */
    subject: text("subject").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.subject, table.windowStart] })],
);
