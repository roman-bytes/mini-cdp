// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_SORT, PEOPLE_PAGE_SIZE, type Profile } from "../directory";
import type { PeopleParams } from "../people-params";
import { countLabel, PeopleDirectory } from "./people-directory";
import { filterFields, PeopleFilters } from "./people-filters";
import { PeopleTable } from "./people-table";

const DEFAULTS: PeopleParams = { filters: {}, sort: DEFAULT_SORT, page: 1, pageSize: PEOPLE_PAGE_SIZE };

const PERSON: Profile = {
  personId: "3f6972bf-3046-4a1b-a662-47e26413d514",
  email: "julia.evans230@gmail.com",
  kind: "subscriber",
  status: "active",
  acquisitionSource: "instagram",
  signupDate: "2026-09-13",
  lastOpenDate: "2026-09-15",
  hasAppAccount: true,
  appAccountCreatedOn: "2026-08-22",
  webVisitCount: 0,
  firstVisitAt: null,
  lastVisitAt: null,
  appEventCount: 0,
  lastAppEventAt: null,
};

describe("filterFields", () => {
  it("lists the six filters with their current values", () => {
    const fields = filterFields({ ...DEFAULTS, filters: { kind: "subscriber", hasAppAccount: false } });

    expect(fields.map((field) => [field.name, field.value])).toEqual([
      ["type", "subscriber"],
      ["status", ""],
      ["source", ""],
      ["engagement", ""],
      ["app", "no"],
      ["web", ""],
    ]);
  });
});

describe("PeopleFilters", () => {
  it("is a search form for /people with every filter", () => {
    render(<PeopleFilters params={DEFAULTS} />);

    expect(screen.getByRole("search")).toHaveAttribute("action", "/people");
    for (const label of ["Type", "Status", "Signup source", "Email engagement", "App account", "Website"]) {
      expect(screen.getByRole("combobox", { name: label })).toBeInTheDocument();
    }
  });

  it("shows the current choices and offers to clear them", () => {
    render(<PeopleFilters params={{ ...DEFAULTS, filters: { source: "instagram", query: "julia" } }} />);

    expect(screen.getByRole("combobox", { name: "Signup source" })).toHaveValue("instagram");
    expect(screen.getByRole("searchbox", { name: "Search people" })).toHaveValue("julia");
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/people");
  });

  it("keeps a chosen sort and page size when the filters change", () => {
    const { container } = render(
      <PeopleFilters params={{ ...DEFAULTS, sort: { column: "web_visits", direction: "desc" }, pageSize: 100 }} />,
    );

    const hidden = [...container.querySelectorAll("input[type=hidden]")].map((input) => [
      input.getAttribute("name"),
      input.getAttribute("value"),
    ]);
    expect(hidden).toEqual([
      ["sort", "web_visits"],
      ["dir", "desc"],
      ["size", "100"],
    ]);
    expect(screen.queryByRole("link", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});

describe("PeopleTable sorting", () => {
  it("makes the sortable headers links and marks the current sort", () => {
    render(
      <PeopleTable
        people={[PERSON]}
        sorting={{ current: { column: "signup_date", direction: "desc" }, hrefFor: (column) => `/people?sort=${column}` }}
      />,
    );

    const signedUp = screen.getByRole("columnheader", { name: /Signed up/ });
    expect(signedUp).toHaveAttribute("aria-sort", "descending");
    expect(within(signedUp).getByRole("link")).toHaveAttribute("href", "/people?sort=signup_date");
    expect(screen.getByRole("columnheader", { name: /Web visits/ })).toHaveAttribute("aria-sort", "none");
    expect(within(screen.getByRole("columnheader", { name: "Type" })).queryByRole("link")).not.toBeInTheDocument();
  });

  it("has plain headers without sorting", () => {
    render(<PeopleTable people={[PERSON]} />);

    expect(within(screen.getByRole("columnheader", { name: "Person" })).queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("PeopleFilters on another page", () => {
  it("submits to that page, with its own search label", () => {
    render(<PeopleFilters params={{ ...DEFAULTS, filters: { status: "active" } }} basePath="/segments/saved/abc" searchLabel="Search this segment" />);

    expect(screen.getByRole("search")).toHaveAttribute("action", "/segments/saved/abc");
    expect(screen.getByRole("searchbox", { name: "Search this segment" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/segments/saved/abc");
  });
});

describe("countLabel", () => {
  it("counts people, in the singular for one", () => {
    expect(countLabel(2930, DEFAULTS)).toBe("2,930 people");
    expect(countLabel(1, DEFAULTS)).toBe("1 person");
  });

  it("says how many of a scoped group are shown when filters narrow it", () => {
    const filtered = { ...DEFAULTS, filters: { engagement: "never" as const } };

    expect(countLabel(146, filtered, { total: 229, name: "this segment" })).toBe("146 of 229 people in this segment");
    expect(countLabel(229, DEFAULTS, { total: 229, name: "this segment" })).toBe("229 people");
  });
});

describe("PeopleDirectory", () => {
  it("shows the filters, the count, the table and the paging, with every link on its own page", () => {
    render(
      <PeopleDirectory
        params={DEFAULTS}
        result={{ people: [PERSON], total: 1, page: 1, pageSize: PEOPLE_PAGE_SIZE }}
        basePath="/segments/saved/abc"
        searchLabel="Search this segment"
        scope={{ total: 1, name: "this segment" }}
      />,
    );

    expect(screen.getByRole("searchbox", { name: "Search this segment" })).toBeInTheDocument();
    expect(screen.getByText("1 person")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "julia.evans230@gmail.com" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "100" })).toHaveAttribute("href", "/segments/saved/abc?size=100");
    expect(within(screen.getByRole("columnheader", { name: /Signed up/ })).getByRole("link")).toHaveAttribute(
      "href",
      "/segments/saved/abc?sort=signup_date",
    );
  });
});
