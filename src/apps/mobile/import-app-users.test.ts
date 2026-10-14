import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { findOrCreatePerson, findPersonByIdentifier } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import type { RawAppUserRow } from "./app-user-rows";
import { importAppUsers, planAppUserImport } from "./import-app-users";
import { accounts, rawAppUsers } from "./schema";

function rawRow(overrides: Partial<RawAppUserRow> = {}): RawAppUserRow {
  return {
    user_id: "u_2b6447a3",
    email: "julia.evans230@gmail.com",
    created_at: "2026-08-22",
    ...overrides,
  };
}

describe("planAppUserImport", () => {
  it("loads each distinct user ID once", () => {
    const plan = planAppUserImport([rawRow(), rawRow({ user_id: "u_other", email: "o@example.com" })]);

    expect(plan.appUsers.map((appUser) => appUser.userId)).toEqual(["u_2b6447a3", "u_other"]);
    expect(plan.rows.map((row) => row.result.outcome)).toEqual(["loaded", "loaded"]);
  });

  it("marks a repeated user ID as merged and keeps the first row", () => {
    const plan = planAppUserImport([rawRow(), rawRow({ created_at: "2026-09-01" })]);

    expect(plan.appUsers).toHaveLength(1);
    expect(plan.appUsers[0].createdOn).toBe("2026-08-22");
    expect(plan.rows[1].result).toEqual({ outcome: "merged", reason: "Duplicate of line 2" });
  });

  it("sets aside an unusable row", () => {
    const plan = planAppUserImport([rawRow({ email: "nope" })]);

    expect(plan.appUsers).toHaveLength(0);
    expect(plan.rows[0].result).toEqual({ outcome: "set_aside", reason: "Invalid email" });
  });
});

describe("importAppUsers", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("attaches an account to the person who already has that email", async () => {
    const subscriber = await findOrCreatePerson(db, "email", "julia.evans230@gmail.com", "newsletter");

    await importAppUsers(db, [rawRow({ email: "JULIA.EVANS230@GMAIL.COM" })]);

    const [account] = await db.select().from(accounts);
    expect(account).toEqual({
      userId: "u_2b6447a3",
      personId: subscriber,
      createdOn: "2026-08-22",
    });
  });

  it("creates an app-only person when nobody has that email", async () => {
    await importAppUsers(db, [rawRow({ user_id: "u_09acb8a4", email: "appuser17@gmail.com" })]);

    const personId = await findPersonByIdentifier(db, "email", "appuser17@gmail.com");
    const [account] = await db.select().from(accounts);

    expect(personId).not.toBeNull();
    expect(account.personId).toBe(personId);
  });

  it("links the user ID to the person, so app events can find them", async () => {
    await importAppUsers(db, [rawRow()]);

    const byUserId = await findPersonByIdentifier(db, "user_id", "u_2b6447a3");
    const byEmail = await findPersonByIdentifier(db, "email", "julia.evans230@gmail.com");

    expect(byUserId).toBe(byEmail);
  });

  it("puts two accounts with the same email on one person", async () => {
    await importAppUsers(db, [rawRow({ user_id: "u_a" }), rawRow({ user_id: "u_b" })]);

    const stored = await db.select().from(accounts);

    expect(stored).toHaveLength(2);
    expect(stored[0].personId).toBe(stored[1].personId);
  });

  it("keeps every source row in the raw layer", async () => {
    await importAppUsers(db, [rawRow({ email: "PAUL@EXAMPLE.COM" }), rawRow({ user_id: "", email: "x@example.com" })]);

    const raw = await db.select().from(rawAppUsers).orderBy(asc(rawAppUsers.rowNumber));

    expect(raw.map((row) => [row.rowNumber, row.outcome, row.reason, row.email])).toEqual([
      [2, "loaded", null, "PAUL@EXAMPLE.COM"],
      [3, "set_aside", "Missing user ID", "x@example.com"],
    ]);
  });

  it("is safe to run twice", async () => {
    await importAppUsers(db, [rawRow()]);
    await importAppUsers(db, [rawRow()]);

    expect(await db.select().from(accounts)).toHaveLength(1);
    expect(await db.select().from(rawAppUsers)).toHaveLength(1);
  });
});
