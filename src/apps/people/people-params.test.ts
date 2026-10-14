import { describe, expect, it } from "vitest";

import { DEFAULT_SORT, PEOPLE_PAGE_SIZE } from "./directory";
import { hasFilters, parsePeopleParams, peopleHref, sortHref, type PeopleParams } from "./people-params";

const DEFAULTS: PeopleParams = { filters: {}, sort: DEFAULT_SORT, page: 1, pageSize: PEOPLE_PAGE_SIZE };

describe("parsePeopleParams", () => {
  it("reads every filter, the sort and the paging", () => {
    expect(
      parsePeopleParams({
        q: " julia ",
        type: "subscriber",
        status: "active",
        source: "instagram",
        engagement: "never",
        app: "yes",
        web: "no",
        sort: "last_open",
        dir: "desc",
        page: "3",
        size: "100",
      }),
    ).toEqual({
      filters: {
        query: "julia",
        kind: "subscriber",
        status: "active",
        source: "instagram",
        engagement: "never",
        hasAppAccount: true,
        hasVisitedWebsite: false,
      },
      sort: { column: "last_open", direction: "desc" },
      page: 3,
      pageSize: 100,
    });
  });

  it("falls back to the defaults when nothing is set", () => {
    expect(parsePeopleParams({})).toEqual({
      filters: {
        query: undefined,
        kind: undefined,
        status: undefined,
        source: undefined,
        engagement: undefined,
        hasAppAccount: undefined,
        hasVisitedWebsite: undefined,
      },
      sort: DEFAULT_SORT,
      page: 1,
      pageSize: PEOPLE_PAGE_SIZE,
    });
  });

  it("ignores values it does not know instead of trusting them", () => {
    const params = parsePeopleParams({ type: "admin", source: "tiktok", app: "maybe", sort: "password", size: "9999", page: "-2" });

    expect(params.filters.kind).toBeUndefined();
    expect(params.filters.source).toBeUndefined();
    expect(params.filters.hasAppAccount).toBeUndefined();
    expect(params.sort).toEqual(DEFAULT_SORT);
    expect(params.pageSize).toBe(PEOPLE_PAGE_SIZE);
    expect(params.page).toBe(1);
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parsePeopleParams({ status: ["unsubscribed", "active"] }).filters.status).toBe("unsubscribed");
  });
});

describe("peopleHref", () => {
  it("is just /people for the default view", () => {
    expect(peopleHref(DEFAULTS)).toBe("/people");
  });

  it("writes only what differs from the defaults", () => {
    expect(
      peopleHref({
        filters: { kind: "subscriber", hasAppAccount: false, query: "a b" },
        sort: { column: "web_visits", direction: "desc" },
        page: 2,
        pageSize: 25,
      }),
    ).toBe("/people?q=a+b&type=subscriber&app=no&sort=web_visits&dir=desc&size=25&page=2");
  });

  it("round-trips through parsePeopleParams", () => {
    const params: PeopleParams = {
      filters: { status: "active", engagement: "lapsed", hasVisitedWebsite: true },
      sort: { column: "signup_date", direction: "asc" },
      page: 4,
      pageSize: 200,
    };
    const query = Object.fromEntries(new URL(`http://x${peopleHref(params)}`).searchParams);

    expect(parsePeopleParams(query)).toMatchObject(params);
  });
});

describe("a people table on another page", () => {
  it("builds addresses on that page instead of /people", () => {
    const base = "/segments/saved/abc";

    expect(peopleHref(DEFAULTS, base)).toBe(base);
    expect(peopleHref({ ...DEFAULTS, filters: { engagement: "never" } }, base)).toBe(`${base}?engagement=never`);
    expect(sortHref(DEFAULTS, "web_visits", base)).toBe(`${base}?sort=web_visits`);
  });
});

describe("sortHref", () => {
  it("sorts by a new column ascending and starts at page one", () => {
    expect(sortHref({ ...DEFAULTS, page: 5 }, "signup_date")).toBe("/people?sort=signup_date");
  });

  it("flips the direction when the column is already sorted", () => {
    expect(sortHref(DEFAULTS, "email")).toBe("/people?sort=email&dir=desc");
    expect(sortHref({ ...DEFAULTS, sort: { column: "email", direction: "desc" } }, "email")).toBe("/people");
  });

  it("keeps the filters", () => {
    expect(sortHref({ ...DEFAULTS, filters: { source: "x" } }, "last_open")).toBe("/people?source=x&sort=last_open");
  });
});

describe("hasFilters", () => {
  it("is true when any filter is set, including a false one", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ query: undefined })).toBe(false);
    expect(hasFilters({ hasAppAccount: false })).toBe(true);
  });
});
