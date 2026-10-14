import { desc, eq } from "drizzle-orm";

import type { Db } from "@/shared/db/client";

import { visits } from "./schema";

/** One stored page view. */
export type Visit = typeof visits.$inferSelect;

/** Every page view by one person, newest first. */
export async function listVisitsForPerson(db: Db, personId: string): Promise<Visit[]> {
  return db
    .select()
    .from(visits)
    .where(eq(visits.personId, personId))
    .orderBy(desc(visits.occurredAt), desc(visits.id));
}
