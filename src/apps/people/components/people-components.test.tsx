// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Profile } from "../directory";
import type { TimelineEntry } from "../timeline";
import { PeopleTable } from "./people-table";
import { personName } from "./person-labels";
import { AppCard, daysAgo, IdentityTable, NewsletterCard, WebCard } from "./profile-cards";
import { TimelineFilter, TimelineTable } from "./timeline-table";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    personId: "3f6972bf-3046-4a1b-a662-47e26413d514",
    email: "julia.evans230@gmail.com",
    kind: "subscriber",
    status: "active",
    acquisitionSource: "instagram",
    signupDate: "2026-09-13",
    lastOpenDate: "2026-09-15",
    hasAppAccount: true,
    appAccountCreatedOn: "2026-08-22",
    webVisitCount: 1234,
    firstVisitAt: new Date("2026-09-13T10:00:00Z"),
    lastVisitAt: new Date("2026-09-20T18:30:00Z"),
    appEventCount: 2,
    lastAppEventAt: null,
    ...overrides,
  };
}

describe("personName", () => {
  it("uses the email, or says there is none", () => {
    expect(personName({ email: "a@example.com" })).toBe("a@example.com");
    expect(personName({ email: null })).toBe("No email on file");
  });
});

describe("PeopleTable", () => {
  it("shows a person's details and links to their profile", () => {
    render(<PeopleTable people={[profile()]} />);

    const row = screen.getByRole("link", { name: "julia.evans230@gmail.com" }).closest("tr")!;
    expect(screen.getByRole("link", { name: "julia.evans230@gmail.com" })).toHaveAttribute(
      "href",
      "/people/3f6972bf-3046-4a1b-a662-47e26413d514",
    );
    const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual([
      "julia.evans230@gmail.com", "Subscriber", "Active", "Instagram",
      "Sep 13, 2026", "Sep 15, 2026", "1,234", "2", "Yes",
    ]);
  });

  it("tags a subscriber who never opened", () => {
    render(<PeopleTable people={[profile({ lastOpenDate: null })]} />);

    expect(screen.getByText("Never opened")).toBeInTheDocument();
  });

  it("shows dashes, not a tag, for someone who is not a subscriber", () => {
    render(
      <PeopleTable
        people={[profile({ kind: "app_only", status: null, acquisitionSource: null, signupDate: null, lastOpenDate: null })]}
      />,
    );

    expect(screen.getByText("App only")).toBeInTheDocument();
    expect(screen.queryByText("Never opened")).not.toBeInTheDocument();
  });

  it("says so when the list is empty", () => {
    render(<PeopleTable people={[]} />);

    expect(screen.getByText("Nobody matches.")).toBeInTheDocument();
  });
});

describe("daysAgo", () => {
  it.each([
    ["2026-09-28", "today"],
    ["2026-09-27", "1 day ago"],
    ["2026-09-15", "13 days ago"],
    [null, "—"],
  ])("describes %j as %j", (date, expected) => {
    expect(daysAgo(date, "2026-09-28")).toBe(expected);
  });
});

describe("profile cards", () => {
  it("shows the newsletter facts with days since the last open", () => {
    render(<NewsletterCard profile={profile()} today="2026-09-28" />);

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("13 days ago")).toBeInTheDocument();
  });

  it("says when the person is not a subscriber", () => {
    render(<NewsletterCard profile={profile({ kind: "app_only" })} today="2026-09-28" />);

    expect(screen.getByText("Not a newsletter subscriber.")).toBeInTheDocument();
  });

  it("shows web visit totals and times", () => {
    render(<WebCard profile={profile()} />);

    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("Sep 20, 2026, 18:30 UTC")).toBeInTheDocument();
  });

  it("shows app accounts, event counts and devices", () => {
    render(
      <AppCard
        accounts={[{ userId: "u_2b6447a3", personId: "p", createdOn: "2026-08-22" }]}
        summary={{ counts: { app_open: 1, read_story: 3, link_click: 0, login: 1 }, devices: ["d_4b21e8"] }}
      />,
    );

    expect(screen.getByText("Account u_2b6447a3")).toBeInTheDocument();
    expect(screen.getByText("Created Aug 22, 2026")).toBeInTheDocument();
    expect(screen.getByText("read_story").closest("div")).toHaveTextContent("3");
    expect(screen.getByText("d_4b21e8")).toBeInTheDocument();
  });

  it("says when there is no app account or activity", () => {
    render(
      <AppCard accounts={[]} summary={{ counts: { app_open: 0, read_story: 0, link_click: 0, login: 0 }, devices: [] }} />,
    );

    expect(screen.getByText("No app account and no app activity.")).toBeInTheDocument();
  });
});

describe("IdentityTable", () => {
  it("lists each identifier with its kind and the app that linked it", () => {
    render(
      <IdentityTable
        identifiers={[
          { type: "email", value: "a@example.com", source: "newsletter", createdAt: new Date() },
          { type: "user_id", value: "u_1", source: "mobile", createdAt: new Date() },
        ]}
      />,
    );

    const row = screen.getByText("u_1").closest("tr")!;
    expect(within(row).getByText("App user ID")).toBeInTheDocument();
    expect(within(row).getByText("mobile")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });
});

describe("timeline", () => {
  const entries: TimelineEntry[] = [
    { key: "app-1", source: "app", at: new Date("2026-09-28T14:22:05Z"), action: "read_story", subject: "ai-regulation-bill", detail: "device d_1" },
    { key: "web-1", source: "web", at: new Date("2026-09-13T10:00:00Z"), action: "Visited", subject: "/subscribe", detail: "via instagram" },
  ];

  it("shows each entry with its time, source and detail", () => {
    render(<TimelineTable entries={entries} />);

    const row = screen.getByText("/subscribe").closest("tr")!;
    expect(within(row).getByText("Sep 13, 2026, 10:00 UTC")).toBeInTheDocument();
    expect(within(row).getByText("Web")).toBeInTheDocument();
    expect(within(row).getByText("via instagram")).toBeInTheDocument();
    expect(screen.getByText("ai-regulation-bill")).toBeInTheDocument();
  });

  it("says when there is no activity", () => {
    render(<TimelineTable entries={[]} />);

    expect(screen.getByText("No activity to show.")).toBeInTheDocument();
  });

  it("links to each source filter and marks the current one", () => {
    render(<TimelineFilter basePath="/people/abc" current="app" />);

    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/people/abc");
    expect(screen.getByRole("link", { name: "Web" })).toHaveAttribute("href", "/people/abc?source=web");
    expect(screen.getByRole("link", { name: "App" })).toHaveAttribute("aria-current", "true");
  });
});
