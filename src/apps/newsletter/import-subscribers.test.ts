import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { findPersonByIdentifier } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { importSubscribers, planSubscriberImport } from "./import-subscribers";
import { rawSubscribers, subscriptions } from "./schema";
import type { RawSubscriberRow } from "./subscriber-rows";

function rawRow(overrides: Partial<RawSubscriberRow> = {}): RawSubscriberRow {
  return {
    email: "emily.miller827@gmail.com",
    signup_date: "2026-07-04",
    status: "active",
    acquisition_source: "Instagram",
    last_open_date: "2026-09-04",
    ...overrides,
  };
}

const BLANK_ROW = rawRow({
  email: "",
  signup_date: "",
  status: "",
  acquisition_source: "",
  last_open_date: "",
});

describe("planSubscriberImport", () => {
  it("loads a row with a new email", () => {
    const plan = planSubscriberImport([rawRow()]);

    expect(plan.subscribers).toHaveLength(1);
    expect(plan.rows).toEqual([
      { result: { outcome: "loaded", reason: null }, email: "emily.miller827@gmail.com" },
    ]);
  });

  it("merges a case variant into the first row and says which line it matched", () => {
    const plan = planSubscriberImport([
      rawRow({ email: "other@example.com" }),
      rawRow(),
      rawRow({ email: "EMILY.MILLER827@GMAIL.COM" }),
    ]);

    expect(plan.subscribers).toHaveLength(2);
    expect(plan.rows[2]).toEqual({
      result: { outcome: "merged", reason: "Duplicate of line 3" },
      email: "emily.miller827@gmail.com",
    });
  });

  it("merges a padded variant", () => {
    const plan = planSubscriberImport([rawRow(), rawRow({ email: "  emily.miller827@gmail.com " })]);

    expect(plan.subscribers).toHaveLength(1);
    expect(plan.rows[1].result.outcome).toBe("merged");
  });

  it("applies the merge rules when duplicate rows disagree", () => {
    const plan = planSubscriberImport([
      rawRow({ signup_date: "2026-07-04", status: "active", last_open_date: "2026-09-04" }),
      rawRow({ signup_date: "2026-07-01", status: "unsubscribed", last_open_date: "2026-09-10" }),
    ]);

    expect(plan.subscribers[0]).toMatchObject({
      signupDate: "2026-07-01",
      status: "unsubscribed",
      lastOpenDate: "2026-09-10",
    });
  });

  it("sets aside blank and invalid rows without counting them as subscribers", () => {
    const plan = planSubscriberImport([BLANK_ROW, rawRow({ email: "not-an-email" }), rawRow()]);

    expect(plan.subscribers).toHaveLength(1);
    expect(plan.rows.map((row) => row.result)).toEqual([
      { outcome: "set_aside", reason: "Blank row" },
      { outcome: "set_aside", reason: "Invalid email" },
      { outcome: "loaded", reason: null },
    ]);
  });

  it("does not treat several blank rows as duplicates of each other", () => {
    const plan = planSubscriberImport([BLANK_ROW, BLANK_ROW]);

    expect(plan.rows.map((row) => row.result.outcome)).toEqual(["set_aside", "set_aside"]);
  });
});

describe("importSubscribers", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("stores one subscription per distinct email, linked to a person", async () => {
    await importSubscribers(db, [rawRow(), rawRow({ email: "EMILY.MILLER827@GMAIL.COM" })]);

    const stored = await db.select().from(subscriptions);
    const personId = await findPersonByIdentifier(db, "email", "emily.miller827@gmail.com");

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      personId,
      status: "active",
      acquisitionSource: "instagram",
      signupDate: "2026-07-04",
      lastOpenDate: "2026-09-04",
    });
  });

  it("keeps every source row in the raw layer, exactly as written", async () => {
    await importSubscribers(db, [rawRow(), rawRow({ email: "EMILY.MILLER827@GMAIL.COM" }), BLANK_ROW]);

    const raw = await db.select().from(rawSubscribers).orderBy(asc(rawSubscribers.rowNumber));

    expect(raw.map((row) => [row.rowNumber, row.outcome, row.email])).toEqual([
      [2, "loaded", "emily.miller827@gmail.com"],
      [3, "merged", "EMILY.MILLER827@GMAIL.COM"],
      [4, "set_aside", ""],
    ]);
    expect(raw[1].reason).toBe("Duplicate of line 2");
    expect(raw[2].reason).toBe("Blank row");
  });

  it("records the person each loaded or merged row resolved to", async () => {
    await importSubscribers(db, [rawRow(), rawRow({ email: "EMILY.MILLER827@GMAIL.COM" }), BLANK_ROW]);

    const raw = await db.select().from(rawSubscribers).orderBy(asc(rawSubscribers.rowNumber));
    const personId = await findPersonByIdentifier(db, "email", "emily.miller827@gmail.com");

    expect(raw.map((row) => row.personId)).toEqual([personId, personId, null]);
  });

  it("is safe to run twice: same people, no duplicates", async () => {
    const rows = [rawRow(), rawRow({ email: "second@example.com" })];
    await importSubscribers(db, rows);
    const before = await findPersonByIdentifier(db, "email", "second@example.com");

    await importSubscribers(db, rows);
    const after = await findPersonByIdentifier(db, "email", "second@example.com");

    expect(after).toBe(before);
    expect(await db.select().from(subscriptions)).toHaveLength(2);
    expect(await db.select().from(rawSubscribers)).toHaveLength(2);
  });

  it("updates a subscription when a later file changes it", async () => {
    await importSubscribers(db, [rawRow({ status: "active" })]);
    await importSubscribers(db, [rawRow({ status: "unsubscribed", last_open_date: "2026-09-20" })]);

    const [stored] = await db.select().from(subscriptions);

    expect(stored).toMatchObject({ status: "unsubscribed", lastOpenDate: "2026-09-20" });
  });
});
