import { beforeAll, describe, expect, it } from "vitest";

import { findPersonByIdentifier } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { readImportFiles, type ImportFiles } from "./read-files";
import { getImportReport, type ImportReport } from "./report";
import { runImport } from "./run-import";

/**
 * The acceptance test for requirement 1. It loads the three real CSV files
 * and checks the numbers worked out by hand while planning (docs/PLAN.md).
 */
describe("runImport with the assessment files", () => {
  let db: Db;
  let files: ImportFiles;
  let report: ImportReport;

  beforeAll(async () => {
    db = await createTestDb();
    files = await readImportFiles("data");
    await runImport(db, files);
    report = await getImportReport(db);
  }, 120_000);

  it("accounts for every row of every file", () => {
    expect(report.files).toEqual([
      { file: "subscribers.csv", total: 2995, loaded: 2900, merged: 85, setAside: 10 },
      { file: "app_users.csv", total: 930, loaded: 930, merged: 0, setAside: 0 },
      { file: "web_events.csv", total: 10000, loaded: 10000, merged: 0, setAside: 0 },
    ]);
  });

  it("produces the seven numbers from the plan", () => {
    expect(report.checks).toEqual({
      subscriberProfiles: 2900,
      duplicateRowsMerged: 85,
      rowsSetAside: 10,
      appAccountsLinkedToSubscriber: 900,
      appOnlyProfiles: 30,
      webVisitsAttachedToSubscriber: 8441,
      webVisitsAnonymous: 1559,
    });
  });

  it("explains each row that was set aside", () => {
    const reasons = report.issues
      .filter((issue) => issue.outcome === "set_aside")
      .map((issue) => issue.reason);

    expect(reasons.filter((reason) => reason === "Blank row")).toHaveLength(8);
    expect(reasons.filter((reason) => reason === "Invalid email")).toHaveLength(2);
  });

  it("resolves the webhook sample's user ID to a subscriber", async () => {
    const byUserId = await findPersonByIdentifier(db, "user_id", "u_2b6447a3");
    const byEmail = await findPersonByIdentifier(db, "email", "julia.evans230@gmail.com");

    expect(byUserId).not.toBeNull();
    expect(byUserId).toBe(byEmail);
  });

  it("gives the same result when run again, and people keep their IDs", async () => {
    const before = await findPersonByIdentifier(db, "user_id", "u_2b6447a3");

    await runImport(db, files);

    expect(await getImportReport(db)).toEqual(report);
    expect(await findPersonByIdentifier(db, "user_id", "u_2b6447a3")).toBe(before);
  }, 120_000);
});

describe("runImport when a file fails", () => {
  it("rolls everything back, leaving the database as it was", async () => {
    const db = await createTestDb();
    const brokenFiles = {
      subscribers: [
        {
          email: "a@example.com",
          signup_date: "2026-07-04",
          status: "active",
          acquisition_source: "Instagram",
          last_open_date: "",
        },
      ],
      appUsers: [],
      // Not an array of rows: the web import throws after subscribers loaded.
      webEvents: null,
    } as unknown as ImportFiles;

    await expect(runImport(db, brokenFiles)).rejects.toThrow();

    const report = await getImportReport(db);
    expect(report.checks.subscriberProfiles).toBe(0);
    expect(await findPersonByIdentifier(db, "email", "a@example.com")).toBeNull();
  });
});
