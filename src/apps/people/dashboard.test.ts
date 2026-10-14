import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import {
  getEngagementBySource,
  getHeadlineStats,
  getOverview,
  getReach,
  getWeeklySignups,
  markWeekInProgress,
  toReachRows,
} from "./dashboard";

const TODAY = "2026-09-28";

describe("markWeekInProgress", () => {
  it("marks only the week that contains today", () => {
    const weeks = markWeekInProgress(
      [
        { weekStart: "2026-09-21", signups: 70 },
        { weekStart: "2026-09-28", signups: 5 },
      ],
      TODAY,
    );

    expect(weeks.map((week) => week.inProgress)).toEqual([false, true]);
  });
});

describe("toReachRows", () => {
  it("returns all four groups in a fixed order, with zero for missing ones", () => {
    const rows = toReachRows([{ onWeb: true, onApp: true, subscribers: 4 }]);

    expect(rows.map((row) => [row.label, row.subscribers])).toEqual([
      ["Email only", 0],
      ["Email and website", 0],
      ["Email and app", 0],
      ["Email, website and app", 4],
    ]);
  });
});

describe("People home numbers, with the assessment files loaded", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    await runImport(db, await readImportFiles("data"));
  }, 120_000);

  it("reads everything the Home page needs in one call", async () => {
    const overview = await getOverview(db, TODAY);

    expect(overview.stats.subscribers).toBe(2900);
    expect(overview.weeks.length).toBeGreaterThan(10);
    expect(overview.sources).toHaveLength(7);
    expect(overview.reach).toHaveLength(4);
  });

  it("counts the headline numbers", async () => {
    expect(await getHeadlineStats(db, TODAY)).toEqual({
      people: 2930,
      subscribers: 2900,
      activeSubscribers: 2610,
      openedRecently: 2166,
      neverOpened: 470,
      subscribersOnApp: 900,
      subscribersOnWeb: 1400,
    });
  });

  it("counts signups per week, Monday to Sunday, and flags this week as unfinished", async () => {
    const weeks = await getWeeklySignups(db, TODAY);

    expect(weeks[0].weekStart).toBe("2026-06-29");
    expect(weeks.at(-1)).toMatchObject({ weekStart: "2026-09-28", inProgress: true });
    expect(weeks.filter((week) => week.inProgress)).toHaveLength(1);
    expect(weeks.reduce((sum, week) => sum + week.signups, 0)).toBe(2900);
  });

  it("splits each source into engaged, lapsed and never opened, biggest source first", async () => {
    const sources = await getEngagementBySource(db, TODAY);

    expect(sources[0]).toEqual({ source: "instagram", total: 899, engaged: 670, lapsed: 83, neverOpened: 146 });
    expect(sources.map((row) => row.source)).toEqual([
      "instagram", "facebook", "referral", "google", "podcast", "direct", "x",
    ]);
    for (const row of sources) {
      expect(row.engaged + row.lapsed + row.neverOpened).toBe(row.total);
    }
  });

  it("agrees with the segment engine on Instagram's cold subscribers", async () => {
    const [instagram] = await getEngagementBySource(db, TODAY);

    expect(instagram.lapsed + instagram.neverOpened).toBe(229);
  });

  it("counts how many subscribers can be reached beyond email", async () => {
    const reach = await getReach(db);

    expect(reach.map((row) => [row.key, row.subscribers])).toEqual([
      ["email_only", 1031],
      ["email_web", 969],
      ["email_app", 469],
      ["email_web_app", 431],
    ]);
  });
});
