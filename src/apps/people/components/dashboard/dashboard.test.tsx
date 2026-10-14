// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import type { HeadlineStats, ReachRow, SourceEngagement, WeeklySignups } from "../../dashboard";
import { ChartCard } from "./chart-card";
import { roundAxisMax } from "./charts";
import { reachBars, reachTable, signupBars, signupTable, sourceBars, sourceTable } from "./chart-data";
import { PeopleOverview } from "./people-overview";
import { headlineTiles, StatTiles } from "./stat-tiles";

const STATS: HeadlineStats = {
  people: 2930,
  subscribers: 2900,
  activeSubscribers: 2610,
  openedRecently: 2166,
  neverOpened: 470,
  subscribersOnApp: 900,
  subscribersOnWeb: 1400,
};

const WEEKS: WeeklySignups[] = [
  { weekStart: "2026-09-21", signups: 230, inProgress: false },
  { weekStart: "2026-09-28", signups: 12, inProgress: true },
];

const SOURCES: SourceEngagement[] = [
  { source: "instagram", total: 899, engaged: 670, lapsed: 83, neverOpened: 146 },
  { source: null, total: 4, engaged: 4, lapsed: 0, neverOpened: 0 },
];

const REACH: ReachRow[] = [
  { key: "email_only", label: "Email only", subscribers: 1031 },
  { key: "email_web", label: "Email and website", subscribers: 969 },
  { key: "email_app", label: "Email and app", subscribers: 469 },
  { key: "email_web_app", label: "Email, website and app", subscribers: 431 },
];

beforeAll(() => {
  // Charts measure their box; jsdom has no layout, so give it a stand-in.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("headlineTiles", () => {
  it("states each number with what it is out of", () => {
    expect(headlineTiles(STATS)).toEqual([
      { label: "Subscribers", value: 2900, detail: "2,610 active · 30 more people in the app only" },
      { label: "Opened in the last 30 days", value: 2166, detail: "75% of subscribers" },
      { label: "Never opened", value: 470, detail: "16% of subscribers" },
      { label: "Also use the app", value: 900, detail: "31% of subscribers · 1,400 seen on the website" },
    ]);
  });
});

describe("StatTiles", () => {
  it("shows each number with thousands separators", () => {
    render(<StatTiles stats={STATS} />);

    const tile = screen.getByText("Subscribers").closest("li")!;
    expect(within(tile).getByText("2,900")).toBeInTheDocument();
  });
});

describe("chart data", () => {
  it("labels weeks for the axis and marks the unfinished one in the table", () => {
    expect(signupBars(WEEKS).map((bar) => bar.label)).toEqual(["Sep 21", "Sep 28"]);
    expect(signupTable(WEEKS).rows).toEqual([
      ["Sep 21", 230],
      ["Sep 28 (so far)", 12],
    ]);
  });

  it("names each source and writes its total and share not opening", () => {
    expect(sourceBars(SOURCES).map((bar) => [bar.label, bar.endLabel])).toEqual([
      ["Instagram", "899 · 25% not opening"],
      ["Unknown", "4 · 0% not opening"],
    ]);
    expect(sourceTable(SOURCES).rows[0]).toEqual(["Instagram", 899, 670, 83, 146, "25%"]);
  });

  it("writes each reach group's count and share of subscribers", () => {
    expect(reachBars(REACH).map((bar) => bar.endLabel)).toEqual([
      "1,031 · 36%",
      "969 · 33%",
      "469 · 16%",
      "431 · 15%",
    ]);
    expect(reachTable(REACH).rows[3]).toEqual(["Email, website and app", 431]);
  });
});

describe("ChartCard", () => {
  it("shows the title, the reading and a table view of the numbers", () => {
    render(
      <ChartCard title="Weekly signups" description="Per week." table={{ columns: ["Week", "Signups"], rows: [["Sep 21", 1230]] }}>
        <div>chart</div>
      </ChartCard>,
    );

    expect(screen.getByText("Weekly signups")).toBeInTheDocument();
    expect(screen.getByText("Per week.")).toBeInTheDocument();
    expect(screen.getByText("Show as table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1,230" })).toBeInTheDocument();
  });
});

describe("PeopleOverview", () => {
  it("shows the headline numbers and all three charts with their descriptions", () => {
    render(<PeopleOverview data={{ stats: STATS, weeks: WEEKS, sources: SOURCES, reach: REACH }} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("New subscribers per week")).toBeInTheDocument();
    expect(screen.getByText("Where subscribers can be reached")).toBeInTheDocument();
    expect(screen.getByText("Engagement by signup source")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });
});

describe("roundAxisMax", () => {
  it("rounds up to the next clean step", () => {
    expect(roundAxisMax(247, 50)).toBe(250);
    expect(roundAxisMax(250, 50)).toBe(250);
    expect(roundAxisMax(251, 50)).toBe(300);
  });

  it("never returns less than one step", () => {
    expect(roundAxisMax(0, 50)).toBe(50);
  });
});
