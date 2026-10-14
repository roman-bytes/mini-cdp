import { count } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import { ingestEvent } from "@/apps/mobile/ingest-event";
import { identifiers } from "@/apps/people/schema";
import { saveSegment } from "@/apps/segments/saved";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { findPii } from "./pii";
import { checkSingleStatement, QUERY_ROW_LIMIT, runReadOnlyQuery, toCellValue } from "./query";

describe("checkSingleStatement", () => {
  it("accepts one statement, with or without a trailing semicolon", () => {
    expect(checkSingleStatement("select 1")).toBe("select 1");
    expect(checkSingleStatement("  select 1;  ")).toBe("select 1");
  });

  it("refuses more than one statement, or none", () => {
    expect(checkSingleStatement("select 1; drop table people")).toBeNull();
    expect(checkSingleStatement(" ; ")).toBeNull();
  });
});

describe("toCellValue", () => {
  it("turns database values into plain JSON values", () => {
    expect(toCellValue(new Date("2026-09-28T00:00:00Z"))).toBe("2026-09-28T00:00:00.000Z");
    expect(toCellValue(BigInt(7))).toBe(7);
    expect(toCellValue(undefined)).toBeNull();
    expect(toCellValue({ a: 1 })).toBe('{"a":1}');
    expect(toCellValue("text")).toBe("text");
  });
});

describe("runReadOnlyQuery, with the assessment files loaded", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    await runImport(db, await readImportFiles("data"));
    await ingestEvent(db, {
      id: "evt_story",
      event: "read_story",
      userId: "u_2b6447a3",
      deviceId: "d_4b21e8",
      occurredAt: new Date("2026-09-28T14:22:05Z"),
      properties: { story: "supreme-court-ruling-explained", shared_with: "friend@example.com" },
    });
    await saveSegment(db, "Cold Instagram", { match: "all", rules: [{ field: "source", op: "is", value: "instagram" }] });
  }, 120_000);

  it("answers a question from the PII-free views", async () => {
    const result = await runReadOnlyQuery(
      db,
      "select acquisition_source, count(*)::int as subscribers from people where kind = 'subscriber' group by 1 order by 2 desc",
    );

    expect(result).toMatchObject({ ok: true, columns: ["acquisition_source", "subscribers"], totalRows: 7 });
    if (result.ok) expect(result.rows[0]).toEqual(["instagram", 899]);
  });

  it("gives the brief's benchmark for Instagram signups who went cold last month", async () => {
    const result = await runReadOnlyQuery(
      db,
      `select count(*)::int as signups,
              count(*) filter (where last_open_date is null or last_open_date < date '2026-09-28' - 30)::int as cold
       from people
       where acquisition_source = 'instagram' and signup_date between '2026-08-01' and '2026-08-31'`,
    );

    expect(result).toMatchObject({ ok: true, rows: [[281, 76]] });
  });

  describe("every view, every row, is free of emails and raw IDs", () => {
    it.each(["people", "web_visits", "app_events", "segments"])("%s", async (view) => {
      const result = await runReadOnlyQuery(db, `select * from ${view}`);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.totalRows).toBeGreaterThan(0);
        expect(result.columns).not.toContain("email");
        expect(findPii(JSON.stringify(result.rows))).toEqual([]);
      }
    });
  });

  it("passes only the story through from app event properties", async () => {
    const result = await runReadOnlyQuery(db, "select event, story from app_events");

    expect(result).toMatchObject({ ok: true, rows: [["read_story", "supreme-court-ruling-explained"]] });
  });

  it.each([
    ["the identifiers table", "select value from people.identifiers"],
    ["the profiles view with emails", "select email from people.profiles"],
    ["the raw source rows", "select email from raw.subscribers"],
    ["the API keys", "select key_hash from auth.api_keys"],
  ])("refuses to read %s, even by its full name", async (_label, query) => {
    const result = await runReadOnlyQuery(db, query);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/permission denied/);
  });

  it("refuses to change anything", async () => {
    const deleted = await runReadOnlyQuery(db, "delete from segments returning *");
    const created = await runReadOnlyQuery(db, "select * from (select 1) x; create table ai.stolen as select 1");

    expect(deleted.ok).toBe(false);
    expect(created).toEqual({ ok: false, error: "Send exactly one SQL statement." });
    expect(await runReadOnlyQuery(db, "select count(*)::int as n from segments")).toMatchObject({ rows: [[1]] });
  });

  it("keeps at most the row limit but counts every row", async () => {
    const result = await runReadOnlyQuery(db, "select page from web_visits");

    expect(result).toMatchObject({ ok: true, totalRows: 10000 });
    if (result.ok) expect(result.rows).toHaveLength(QUERY_ROW_LIMIT);
  });

  it("reports a mistake in the SQL so the model can fix it", async () => {
    const result = await runReadOnlyQuery(db, "select no_such_column from people");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/no_such_column/);
  });

  it("leaves the app's own access untouched afterwards", async () => {
    await runReadOnlyQuery(db, "select 1");
    const [row] = await db.select({ total: count() }).from(identifiers);

    expect(row.total).toBeGreaterThan(0);
  });
});

describe("runReadOnlyQuery value formats", () => {
  it("returns dates as YYYY-MM-DD, timestamps in UTC and numbers as numbers", async () => {
    const db = await createTestDb();
    const result = await runReadOnlyQuery(
      db,
      "select date '2026-09-15' as day, timestamptz '2026-09-28 14:22:05+00' as at, 2::bigint as n, 1.5::numeric as x",
    );

    expect(result).toEqual({
      ok: true,
      columns: ["day", "at", "n", "x"],
      rows: [["2026-09-15", "2026-09-28T14:22:05+00:00", 2, 1.5]],
      totalRows: 1,
    });
  });

  it("knows the columns of a result with no rows", async () => {
    const db = await createTestDb();

    expect(await runReadOnlyQuery(db, "select person_key, kind from people")).toEqual({
      ok: true,
      columns: ["person_key", "kind"],
      rows: [],
      totalRows: 0,
    });
  });
});
