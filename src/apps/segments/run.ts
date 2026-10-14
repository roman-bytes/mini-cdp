import { asc, count, sql } from "drizzle-orm";

import { listPeople, type PeoplePage, type Profile } from "@/apps/people/directory";
import type { PeopleParams } from "@/apps/people/people-params";
import { neverOpened, profiles } from "@/apps/people/profiles-view";
import type { Db } from "@/shared/db/client";

import { compileDefinition } from "./compile";
import type { SegmentDefinition } from "./definition";

/** How many people a segment holds, and how many of them never opened. */
export type SegmentSize = {
  total: number;
  neverOpened: number;
};

/** A person in a segment, with the tag the list shows beside them. */
export type SegmentMember = Profile & { neverOpened: boolean };

/** Counts a segment's people right now. Nothing is cached. */
export async function countSegment(
  db: Db,
  definition: SegmentDefinition,
  today: string,
): Promise<SegmentSize> {
  const [row] = await db
    .select({
      total: count(),
      neverOpened: sql<number>`count(*) filter (where ${neverOpened})`.mapWith(Number),
    })
    .from(profiles)
    .where(compileDefinition(definition, today));
  return row;
}

function tagNeverOpened(profile: Profile): SegmentMember {
  return {
    ...profile,
    neverOpened: profile.kind === "subscriber" && profile.lastOpenDate === null,
  };
}

/** A segment's people, ordered by email. Pass no limit to get all of them. */
export async function listSegmentMembers(
  db: Db,
  definition: SegmentDefinition,
  today: string,
  limit?: number,
): Promise<SegmentMember[]> {
  const query = db
    .select()
    .from(profiles)
    .where(compileDefinition(definition, today))
    .orderBy(asc(profiles.email), asc(profiles.personId));
  const rows = limit === undefined ? await query : await query.limit(limit);
  return rows.map(tagNeverOpened);
}

/**
 * One page of a segment's people, with the same search, filters, sorting and
 * paging as the People table. The segment's rules come first; the filters
 * only narrow within the segment.
 */
export async function listSegmentPeople(
  db: Db,
  definition: SegmentDefinition,
  today: string,
  params: PeopleParams,
): Promise<PeoplePage> {
  return listPeople(db, { ...params, today, scope: compileDefinition(definition, today) });
}
