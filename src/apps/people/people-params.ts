import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/apps/newsletter/schema";
import { CHANNEL_LABELS } from "@/shared/channels";

import {
  clampPage,
  DEFAULT_SORT,
  ENGAGEMENT_FILTERS,
  PEOPLE_PAGE_SIZE,
  SORT_COLUMNS,
  type EngagementFilter,
  type PeopleFilters,
  type PeopleSort,
  type SortColumn,
} from "./directory";
import { PERSON_KINDS, type PersonKind } from "./profiles-view";

/** Everything the People page reads from its address. */
export type PeopleParams = {
  filters: PeopleFilters;
  sort: PeopleSort;
  page: number;
  pageSize: number;
};

export const PAGE_SIZES = [25, 50, 100, 200];

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The value when it is one of the allowed ones, otherwise undefined. */
function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.find((candidate) => candidate === value);
}

function yesNo(value: string | undefined): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

/**
 * Reads filters, sorting and paging from the address. Anything unknown is
 * ignored rather than trusted, so a hand-edited link cannot break the page.
 */
export function parsePeopleParams(searchParams: SearchParams): PeopleParams {
  const value = (key: string) => first(searchParams[key])?.trim() || undefined;
  const filters: PeopleFilters = {
    query: value("q"),
    kind: oneOf<PersonKind>(value("type"), PERSON_KINDS),
    status: oneOf<SubscriptionStatus>(value("status"), SUBSCRIPTION_STATUSES),
    source: oneOf(value("source"), Object.keys(CHANNEL_LABELS)),
    engagement: oneOf<EngagementFilter>(value("engagement"), ENGAGEMENT_FILTERS),
    hasAppAccount: yesNo(value("app")),
    hasVisitedWebsite: yesNo(value("web")),
  };
  const column = oneOf<SortColumn>(value("sort"), SORT_COLUMNS);
  const sort: PeopleSort = column
    ? { column, direction: value("dir") === "desc" ? "desc" : "asc" }
    : DEFAULT_SORT;
  const size = Number(value("size"));

  return {
    filters,
    sort,
    page: clampPage(Number(value("page") ?? 1)),
    pageSize: PAGE_SIZES.includes(size) ? size : PEOPLE_PAGE_SIZE,
  };
}

function yesNoParam(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "yes" : "no";
}

/**
 * The address for a view of a people table: the People page, or a saved
 * segment's page. Defaults are left out to keep it short.
 */
export function peopleHref(params: PeopleParams, basePath = "/people"): string {
  const entries: [string, string | undefined][] = [
    ["q", params.filters.query],
    ["type", params.filters.kind],
    ["status", params.filters.status],
    ["source", params.filters.source],
    ["engagement", params.filters.engagement],
    ["app", yesNoParam(params.filters.hasAppAccount)],
    ["web", yesNoParam(params.filters.hasVisitedWebsite)],
    ["sort", params.sort.column === DEFAULT_SORT.column && params.sort.direction === DEFAULT_SORT.direction ? undefined : params.sort.column],
    ["dir", params.sort.direction === "desc" ? "desc" : undefined],
    ["size", params.pageSize === PEOPLE_PAGE_SIZE ? undefined : String(params.pageSize)],
    ["page", params.page > 1 ? String(params.page) : undefined],
  ];
  const query = new URLSearchParams(entries.filter((entry): entry is [string, string] => Boolean(entry[1])));
  const text = query.toString();
  return text ? `${basePath}?${text}` : basePath;
}

/**
 * The address after clicking a column header: sort by that column, flipping
 * the direction if it is already the sort column. Paging starts over.
 */
export function sortHref(params: PeopleParams, column: SortColumn, basePath = "/people"): string {
  const flipping = params.sort.column === column;
  const direction = flipping && params.sort.direction === "asc" ? "desc" : "asc";
  return peopleHref({ ...params, sort: { column, direction: flipping ? direction : "asc" }, page: 1 }, basePath);
}

/** True when any filter is set, so the page can offer to clear them. */
export function hasFilters(filters: PeopleFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined);
}
