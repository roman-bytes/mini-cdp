import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { clampPage, escapeLike, findMatchedIdentifiers, getProfile, listPeople, searchPeople } from "./directory";
import { findPersonByIdentifier, listIdentifiers } from "./identifiers";
import { profiles } from "./profiles-view";

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

  describe("listPeople", () => {
    const TODAY = "2026-09-28";
    const total = async (filters: Parameters<typeof listPeople>[1] extends infer O ? O extends { filters?: infer F } ? F : never : never) =>
      (await listPeople(db, { filters, today: TODAY })).total;

    it("filters by type and status", async () => {
      expect(await total({ kind: "app_only" })).toBe(30);
      expect(await total({ kind: "subscriber", status: "unsubscribed" })).toBe(290);
    });

    it("filters by signup source", async () => {
      expect(await total({ source: "instagram" })).toBe(899);
    });

    it("filters by email engagement, matching the dashboard and segments", async () => {
      expect(await total({ engagement: "engaged" })).toBe(2166);
      expect(await total({ engagement: "never" })).toBe(470);
      expect(await total({ engagement: "lapsed" })).toBe(2900 - 2166 - 470);
      expect(await total({ source: "instagram", engagement: "never" })).toBe(146);
    });

    it("filters by app account and website visits", async () => {
      expect(await total({ hasAppAccount: true })).toBe(930);
      expect(await total({ hasVisitedWebsite: true })).toBe(1400);
      expect(await total({ hasVisitedWebsite: false, kind: "subscriber" })).toBe(1500);
    });

    it("combines search text with filters", async () => {
      expect(await total({ query: "julia.evans230", source: "instagram" })).toBe(1);
      expect(await total({ query: "julia.evans230", source: "google" })).toBe(0);
    });

    it("applies a scope before the filters", async () => {
      const instagramOnly = sql`${profiles.acquisitionSource} = 'instagram'`;

      expect((await listPeople(db, { scope: instagramOnly })).total).toBe(899);
      expect((await listPeople(db, { scope: instagramOnly, filters: { status: "active" } })).total).toBe(806);
    });

    it("needs today's date to filter by engagement", async () => {
      await expect(listPeople(db, { filters: { engagement: "engaged" } })).rejects.toThrow(/today/);
    });

    it("sorts by a column in either direction, with empty values last", async () => {
      const newest = await listPeople(db, { sort: { column: "signup_date", direction: "desc" }, pageSize: 3 });
      const oldest = await listPeople(db, { sort: { column: "signup_date", direction: "asc" }, pageSize: 3 });
      const leastRecentOpen = await listPeople(db, {
        filters: { kind: "subscriber" },
        sort: { column: "last_open", direction: "asc" },
        page: 58,
        pageSize: 50,
      });

      expect(newest.people[0].signupDate).toBe("2026-09-28");
      expect(oldest.people[0].signupDate).toBe("2026-07-01");
      expect(leastRecentOpen.people.at(-1)?.lastOpenDate).toBeNull();
    });

    it("sorts by web visits, most first", async () => {
      const page = await listPeople(db, { sort: { column: "web_visits", direction: "desc" }, pageSize: 5 });
      const counts = page.people.map((person) => person.webVisitCount);

      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(counts[0]).toBeGreaterThan(1);
    });
  });

  describe("findMatchedIdentifiers", () => {
    it("says which identifier made each person match", async () => {
      const page = await searchPeople(db, { query: "u_2b6447a3" });
      const matched = await findMatchedIdentifiers(db, [page.people[0].personId], "u_2b6447a3");

      expect(matched.get(page.people[0].personId)).toEqual({ type: "user_id", value: "u_2b6447a3" });
    });

    it("returns nothing for empty text or no people", async () => {
      expect((await findMatchedIdentifiers(db, [], "x")).size).toBe(0);
      expect((await findMatchedIdentifiers(db, ["00000000-0000-4000-8000-000000000000"], "  ")).size).toBe(0);
    });
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
