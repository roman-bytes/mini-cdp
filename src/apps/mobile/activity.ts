import { asc, desc, eq } from "drizzle-orm";

import type { Db } from "@/shared/db/client";

import { accounts, events } from "./schema";

/** One stored app account. */
export type Account = typeof accounts.$inferSelect;

/** One stored app event. */
export type AppEvent = typeof events.$inferSelect;

/** The app accounts that belong to one person, oldest first. */
export async function listAccountsForPerson(db: Db, personId: string): Promise<Account[]> {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.personId, personId))
    .orderBy(asc(accounts.createdOn), asc(accounts.userId));
}

/** Every app event that belongs to one person, newest first by event time. */
export async function listEventsForPerson(db: Db, personId: string): Promise<AppEvent[]> {
  return db
    .select()
    .from(events)
    .where(eq(events.personId, personId))
    .orderBy(desc(events.occurredAt), desc(events.id));
}

/** The latest app events from everyone, newest first by event time. */
export async function listRecentEvents(db: Db, limit = 50): Promise<AppEvent[]> {
  return db.select().from(events).orderBy(desc(events.occurredAt), desc(events.id)).limit(limit);
}
