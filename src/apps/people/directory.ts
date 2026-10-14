import { asc, count, eq, ilike, inArray, type SQL } from "drizzle-orm";

import type { Db } from "@/shared/db/client";
import { isUuid } from "@/shared/ids";

import { profiles } from "./profiles-view";
import { identifiers } from "./schema";

/** One person with everything the apps know about them. */
export type Profile = typeof profiles.$inferSelect;

/** One page of the People list. */
export type PeoplePage = {
  people: Profile[];
  total: number;
  page: number;
  pageSize: number;
};

export const PEOPLE_PAGE_SIZE = 50;

/** Escapes the characters a LIKE pattern treats as wildcards. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * The filter for a search: people with any identifier (email, user ID,
 * visitor ID or device ID) that contains the text. No text means everyone.
 */
function matchesSearch(db: Db, query: string): SQL | undefined {
  const term = query.trim();
  if (term === "") return undefined;

  const matchingPeople = db
    .select({ personId: identifiers.personId })
    .from(identifiers)
    .where(ilike(identifiers.value, `%${escapeLike(term)}%`));
  return inArray(profiles.personId, matchingPeople);
}

/** A page number that is a whole number of at least 1. */
export function clampPage(page: number): number {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

/** Searches people, one page at a time, ordered by email. */
export async function searchPeople(
  db: Db,
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<PeoplePage> {
  const pageSize = options.pageSize ?? PEOPLE_PAGE_SIZE;
  const page = clampPage(options.page ?? 1);
  const where = matchesSearch(db, options.query ?? "");

  const [totals] = await db.select({ total: count() }).from(profiles).where(where);
  const people = await db
    .select()
    .from(profiles)
    .where(where)
    .orderBy(asc(profiles.email), asc(profiles.personId))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { people, total: totals.total, page, pageSize };
}

/** One person's profile, or null when the ID matches nobody. */
export async function getProfile(db: Db, personId: string): Promise<Profile | null> {
  if (!isUuid(personId)) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.personId, personId));
  return profile ?? null;
}
