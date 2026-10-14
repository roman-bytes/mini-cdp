import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import type { ImportFiles } from "./read-files";
import { getImportReport, tallyOutcomes } from "./report";
import { runImport } from "./run-import";

/** A small import that exercises every outcome and every kind of link. */
const SMALL_IMPORT: ImportFiles = {
  subscribers: [
    { email: "sub@example.com", signup_date: "2026-07-04", status: "active", acquisition_source: "Instagram", last_open_date: "" },
    { email: "SUB@EXAMPLE.COM", signup_date: "2026-07-04", status: "active", acquisition_source: "Instagram", last_open_date: "" },
    { email: "not-an-email", signup_date: "2026-08-14", status: "active", acquisition_source: "Instagram", last_open_date: "" },
    { email: "lonely@example.com", signup_date: "2026-08-01", status: "unsubscribed", acquisition_source: "X", last_open_date: "" },
  ],
  appUsers: [
    { user_id: "u_sub", email: "Sub@Example.com", created_at: "2026-08-22" },
    { user_id: "u_apponly", email: "appuser1@gmail.com", created_at: "2026-09-10" },
  ],
  webEvents: [
    { visitor_id: "v_sub", page: "/", timestamp: "2026-07-04 09:00:00", utm_source: "instagram", email: "" },
    { visitor_id: "v_sub", page: "/subscribe", timestamp: "2026-07-04 09:05:00", utm_source: "", email: "sub@example.com" },
    { visitor_id: "v_anon", page: "/about", timestamp: "2026-07-05 12:00:00", utm_source: "", email: "" },
  ],
};

describe("tallyOutcomes", () => {
  it("fills in zero for an outcome that never happened", () => {
    expect(tallyOutcomes("file.csv", [{ outcome: "loaded", total: 5 }])).toEqual({
      file: "file.csv",
      total: 5,
      loaded: 5,
      merged: 0,
      setAside: 0,
    });
  });

  it("adds the outcomes into a total", () => {
    const tally = tallyOutcomes("file.csv", [
      { outcome: "loaded", total: 5 },
      { outcome: "merged", total: 2 },
      { outcome: "set_aside", total: 1 },
    ]);

    expect(tally).toMatchObject({ total: 8, loaded: 5, merged: 2, setAside: 1 });
  });
});

describe("getImportReport", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("reports zeros before anything is imported", async () => {
    const report = await getImportReport(db);

    expect(report.files.map((file) => file.total)).toEqual([0, 0, 0]);
    expect(report.issues).toEqual([]);
    expect(report.checks).toEqual({
      subscriberProfiles: 0,
      duplicateRowsMerged: 0,
      rowsSetAside: 0,
      appAccountsLinkedToSubscriber: 0,
      appOnlyProfiles: 0,
      webVisitsAttachedToSubscriber: 0,
      webVisitsAnonymous: 0,
    });
  });

  it("counts each file's rows by outcome", async () => {
    await runImport(db, SMALL_IMPORT);
    const report = await getImportReport(db);

    expect(report.files).toEqual([
      { file: "subscribers.csv", total: 4, loaded: 2, merged: 1, setAside: 1 },
      { file: "app_users.csv", total: 2, loaded: 2, merged: 0, setAside: 0 },
      { file: "web_events.csv", total: 3, loaded: 3, merged: 0, setAside: 0 },
    ]);
  });

  it("counts people and links across the apps", async () => {
    await runImport(db, SMALL_IMPORT);
    const report = await getImportReport(db);

    expect(report.checks).toEqual({
      subscriberProfiles: 2,
      duplicateRowsMerged: 1,
      rowsSetAside: 1,
      appAccountsLinkedToSubscriber: 1,
      appOnlyProfiles: 1,
      webVisitsAttachedToSubscriber: 2,
      webVisitsAnonymous: 1,
    });
  });

  it("lists merged and set-aside rows in file order, with the value as written", async () => {
    await runImport(db, SMALL_IMPORT);
    const report = await getImportReport(db);

    expect(report.issues).toEqual([
      { file: "subscribers.csv", rowNumber: 3, outcome: "merged", reason: "Duplicate of line 2", value: "SUB@EXAMPLE.COM" },
      { file: "subscribers.csv", rowNumber: 4, outcome: "set_aside", reason: "Invalid email", value: "not-an-email" },
    ]);
  });
});
