import { and, eq, lt, sql } from "drizzle-orm";

import type { Db } from "@/shared/db/client";

import { rateLimits } from "./schema";

export type RateLimit = { limit: number; windowSeconds: number };

/** The start of the fixed time window that `now` falls in. */
export function windowStartFor(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

/**
 * Counts one request against a caller's allowance for the current window and
 * says whether it is allowed. The count lives in the database, so it holds
 * across every server instance.
 */
export async function consumeRateLimit(
  db: Db,
  subject: string,
  rule: RateLimit,
  now: Date = new Date(),
): Promise<boolean> {
  const windowStart = windowStartFor(now, rule.windowSeconds);

  // Earlier windows for this caller are no longer needed.
  await db
    .delete(rateLimits)
    .where(and(eq(rateLimits.subject, subject), lt(rateLimits.windowStart, windowStart)));

  const [row] = await db
    .insert(rateLimits)
    .values({ subject, windowStart, requestCount: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.subject, rateLimits.windowStart],
      set: { requestCount: sql`${rateLimits.requestCount} + 1` },
    })
    .returning({ requestCount: rateLimits.requestCount });

  return row.requestCount <= rule.limit;
}
