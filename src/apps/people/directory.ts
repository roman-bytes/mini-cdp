import { and, asc, count, eq, gt, gte, ilike, inArray, isNull, lt, sql, type AnyColumn, type SQL } from "drizzle-orm";

import type { SubscriptionStatus } from "@/apps/newsletter/schema";
import { daysBefore } from "@/shared/dates-math";

import type { Db } from "@/shared/db/client";
import { isUuid } from "@/shared/ids";

import { ENGAGED_WINDOW_DAYS } from "./dashboard";
import { profiles, type PersonKind } from "./profiles-view";
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

/** How recently a subscriber opened an email, for filtering. */
export const ENGAGEMENT_FILTERS = ["engaged", "lapsed", "never"] as const;
export type EngagementFilter = (typeof ENGAGEMENT_FILTERS)[number];

/** Narrowing the People list. Every filter left out means "any". */
export type PeopleFilters = {
  /** Text found in any identifier: email, user ID, visitor ID or device ID. */
  query?: string;
  kind?: PersonKind;
  status?: SubscriptionStatus;
  source?: string;
  engagement?: EngagementFilter;
  hasAppAccount?: boolean;
  hasVisitedWebsite?: boolean;
};

/** The columns the list can be sorted by. */
export const SORT_COLUMNS = ["email", "signup_date", "last_open", "web_visits", "app_events"] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDirection = "asc" | "desc";
export type PeopleSort = { column: SortColumn; direction: SortDirection };

export const DEFAULT_SORT: PeopleSort = { column: "email", direction: "asc" };

const SORTABLE: Record<SortColumn, SQL.Aliased | AnyColumn> = {
  email: profiles.email,
  signup_date: profiles.signupDate,
  last_open: profiles.lastOpenDate,
  web_visits: profiles.webVisitCount,
  app_events: profiles.appEventCount,
};

/** The condition for one engagement filter. Only subscribers can be engaged, lapsed or never opened. */
function engagementCondition(engagement: EngagementFilter, today: string): SQL {
  const isSubscriber = eq(profiles.kind, "subscriber");
  const since = daysBefore(today, ENGAGED_WINDOW_DAYS);
  if (engagement === "engaged") return and(isSubscriber, gte(profiles.lastOpenDate, since))!;
  if (engagement === "lapsed") return and(isSubscriber, lt(profiles.lastOpenDate, since))!;
  return and(isSubscriber, isNull(profiles.lastOpenDate))!;
}

/** Every condition the filters ask for, joined with AND. Undefined means everyone. */
function filterCondition(db: Db, filters: PeopleFilters, today: string | undefined): SQL | undefined {
  const conditions: (SQL | undefined)[] = [matchesSearch(db, filters.query ?? "")];
  if (filters.kind) conditions.push(eq(profiles.kind, filters.kind));
  if (filters.status) conditions.push(eq(profiles.status, filters.status));
  if (filters.source) conditions.push(eq(profiles.acquisitionSource, filters.source));
  if (filters.hasAppAccount !== undefined) conditions.push(eq(profiles.hasAppAccount, filters.hasAppAccount));
  if (filters.hasVisitedWebsite !== undefined) {
    conditions.push(filters.hasVisitedWebsite ? gt(profiles.webVisitCount, 0) : eq(profiles.webVisitCount, 0));
  }
  if (filters.engagement) {
    if (!today) throw new Error("Filtering by email engagement needs today's date.");
    conditions.push(engagementCondition(filters.engagement, today));
  }
  return and(...conditions);
}

/** Sorts by the chosen column, keeping empty values last either way, then by ID so pages never overlap. */
function orderFor(sort: PeopleSort): SQL[] {
  const direction = sql.raw(sort.direction === "desc" ? "desc" : "asc");
  return [sql`${SORTABLE[sort.column]} ${direction} nulls last`, asc(profiles.personId)];
}

/** People matching the filters, one page at a time, in the chosen order. */
export async function listPeople(
  db: Db,
  options: {
    filters?: PeopleFilters;
    sort?: PeopleSort;
    page?: number;
    pageSize?: number;
    /** Needed only when filtering by email engagement. */
    today?: string;
    /** A condition every row must meet before the filters apply, such as a segment's rules. */
    scope?: SQL;
  } = {},
): Promise<PeoplePage> {
  const pageSize = options.pageSize ?? PEOPLE_PAGE_SIZE;
  const page = clampPage(options.page ?? 1);
  const where = and(options.scope, filterCondition(db, options.filters ?? {}, options.today));

  const [totals] = await db.select({ total: count() }).from(profiles).where(where);
  const people = await db
    .select()
    .from(profiles)
    .where(where)
    .orderBy(...orderFor(options.sort ?? DEFAULT_SORT))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { people, total: totals.total, page, pageSize };
}

/** Searches people by any identifier, one page at a time, ordered by email. */
export async function searchPeople(
  db: Db,
  options: { query?: string; page?: number; pageSize?: number } = {},
): Promise<PeoplePage> {
  return listPeople(db, { filters: { query: options.query }, page: options.page, pageSize: options.pageSize });
}

/**
 * For each person, the first of their identifiers that contains the search
 * text: shown in quick search so it is clear why someone matched.
 */
export async function findMatchedIdentifiers(
  db: Db,
  personIds: string[],
  query: string,
): Promise<Map<string, { type: string; value: string }>> {
  const matched = new Map<string, { type: string; value: string }>();
  const term = query.trim();
  if (term === "" || personIds.length === 0) return matched;

  const rows = await db
    .select({ personId: identifiers.personId, type: identifiers.type, value: identifiers.value })
    .from(identifiers)
    .where(and(inArray(identifiers.personId, personIds), ilike(identifiers.value, `%${escapeLike(term)}%`)))
    .orderBy(asc(identifiers.createdAt), asc(identifiers.value));
  for (const row of rows) {
    if (!matched.has(row.personId)) matched.set(row.personId, { type: row.type, value: row.value });
  }
  return matched;
}

/** One person's profile, or null when the ID matches nobody. */
export async function getProfile(db: Db, personId: string): Promise<Profile | null> {
  if (!isUuid(personId)) return null;
  const [profile] = await db.select().from(profiles).where(eq(profiles.personId, personId));
  return profile ?? null;
}
