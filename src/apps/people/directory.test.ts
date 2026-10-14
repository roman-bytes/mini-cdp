import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { clampPage, escapeLike, getProfile, searchPeople } from "./directory";
import { findPersonByIdentifier, listIdentifiers } from "./identifiers";

describe("escapeLike", () => {
  it("escapes the LIKE wildcards so they match literally", () => {
    expect(escapeLike("100%_done\\")).toBe("100\\%\\_done\\\\");
  });
});

describe("clampPage", () => {
  it("keeps a valid page and repairs an invalid one", () => {
    expect(clampPage(3)).toBe(3);
    expect(clampPage(2.7)).toBe(2);
    expect(clampPage(0)).toBe(1);
    expect(clampPage(Number.NaN)).toBe(1);
  });
});

describe("the People directory, with the assessment files loaded", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    await runImport(db, await readImportFiles("data"));
  }, 120_000);

  it("lists everyone: 2,900 subscribers plus 30 app-only people", async () => {
    const page = await searchPeople(db);

    expect(page.total).toBe(2930);
    expect(page.people).toHaveLength(50);
  });

  it("pages through the list without repeating anyone", async () => {
    const first = await searchPeople(db, { page: 1, pageSize: 10 });
    const second = await searchPeople(db, { page: 2, pageSize: 10 });
    const ids = new Set([...first.people, ...second.people].map((person) => person.personId));

    expect(ids.size).toBe(20);
  });

  it("finds a person by part of their email, in any case", async () => {
    const page = await searchPeople(db, { query: "JULIA.EVANS230" });

    expect(page.people.map((person) => person.email)).toEqual(["julia.evans230@gmail.com"]);
  });

  it("finds the same person by app user ID and by web visitor ID", async () => {
    const byUserId = await searchPeople(db, { query: "u_2b6447a3" });
    const [identifier] = (await listIdentifiers(db, byUserId.people[0].personId)).filter(
      (entry) => entry.type === "visitor_id",
    );

    expect(byUserId.people[0].email).toBe("julia.evans230@gmail.com");
    if (identifier) {
      const byVisitor = await searchPeople(db, { query: identifier.value });
      expect(byVisitor.people[0].personId).toBe(byUserId.people[0].personId);
    }
  });

  it("returns nobody for text that matches nothing", async () => {
    expect((await searchPeople(db, { query: "no-such-person-xyz" })).total).toBe(0);
  });

  it("treats % as a plain character, not as 'match everything'", async () => {
    expect((await searchPeople(db, { query: "%" })).total).toBe(0);
  });

  it("builds a profile that pulls every app's data together", async () => {
    const personId = await findPersonByIdentifier(db, "user_id", "u_2b6447a3");
    const profile = await getProfile(db, personId!);

    expect(profile).toMatchObject({
      email: "julia.evans230@gmail.com",
      kind: "subscriber",
      status: "active",
      acquisitionSource: "instagram",
      signupDate: "2026-09-13",
      lastOpenDate: "2026-09-15",
      hasAppAccount: true,
      appAccountCreatedOn: "2026-08-22",
      appEventCount: 0,
    });
  });

  it("marks an app user who is not on the newsletter as app-only", async () => {
    const personId = await findPersonByIdentifier(db, "email", "appuser17@gmail.com");
    const profile = await getProfile(db, personId!);

    expect(profile).toMatchObject({ kind: "app_only", status: null, hasAppAccount: true });
  });

  it("returns null for an unknown or malformed ID", async () => {
    expect(await getProfile(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await getProfile(db, "not-a-uuid")).toBeNull();
  });

  it("lists every identifier that points at a person", async () => {
    const personId = await findPersonByIdentifier(db, "user_id", "u_2b6447a3");
    const types = (await listIdentifiers(db, personId!)).map((entry) => entry.type);

    expect(types).toContain("email");
    expect(types).toContain("user_id");
  });
});
