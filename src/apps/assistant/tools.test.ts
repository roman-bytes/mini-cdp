import { beforeEach, describe, expect, it } from "vitest";

import { importSubscribers } from "@/apps/newsletter/import-subscribers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { ASSISTANT_TOOLS, executeTool, toSegmentRule } from "./tools";

describe("ASSISTANT_TOOLS", () => {
  it("offers exactly the two tools, each with a JSON Schema for its input", () => {
    expect(ASSISTANT_TOOLS.map((tool) => [tool.name, tool.parameters.type])).toEqual([
      ["run_query", "object"],
      ["create_segment", "object"],
    ]);
  });
});

describe("toSegmentRule", () => {
  it("reads a number operator's text as a number", () => {
    expect(toSegmentRule({ field: "last_open", op: "not_within_days", value: "30" })).toEqual({
      field: "last_open",
      op: "not_within_days",
      value: 30,
    });
  });

  it("drops the value for an operator that takes none", () => {
    expect(toSegmentRule({ field: "app_account", op: "has", value: "" })).toEqual({ field: "app_account", op: "has" });
  });

  it("keeps a text or choice value as text", () => {
    expect(toSegmentRule({ field: "source", op: "is", value: " instagram " })).toEqual({
      field: "source",
      op: "is",
      value: "instagram",
    });
  });
});

describe("executeTool", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
    await importSubscribers(db, [
      { email: "a@example.com", signup_date: "2026-08-01", status: "active", acquisition_source: "Instagram", last_open_date: "" },
      { email: "b@example.com", signup_date: "2026-08-02", status: "active", acquisition_source: "Google", last_open_date: "2026-09-27" },
    ]);
  });

  it("runs a query and returns rows to the model and a table to the teammate", async () => {
    const outcome = await executeTool(
      db,
      { name: "run_query", input: { title: "People by source", sql: "select acquisition_source, person_key from people order by 1" } },
      "2026-09-28",
    );

    expect(outcome.isError).toBe(false);
    expect(JSON.parse(outcome.content)).toMatchObject({ columns: ["acquisition_source", "person_key"], total_rows: 2 });
    expect(outcome.output).toMatchObject({ kind: "table", title: "People by source", totalRows: 2 });
  });

  it("returns a query error to the model instead of throwing", async () => {
    const outcome = await executeTool(db, { name: "run_query", input: { title: "x", sql: "select email from people" } }, "2026-09-28");

    expect(outcome.isError).toBe(true);
    expect(JSON.parse(outcome.content).error).toMatch(/email/);
    expect(outcome.output).toBeUndefined();
  });

  it("saves a segment and reports its size", async () => {
    const outcome = await executeTool(
      db,
      {
        name: "create_segment",
        input: { name: "Instagram, never opened", match: "all", rules: [
          { field: "source", op: "is", value: "instagram" },
          { field: "last_open", op: "never", value: "" },
        ] },
      },
      "2026-09-28",
    );

    expect(outcome.isError).toBe(false);
    expect(outcome.output).toMatchObject({ kind: "segment", name: "Instagram, never opened", total: 1, neverOpened: 1 });
    expect(JSON.parse(outcome.content)).toMatchObject({ people: 1, never_opened: 1 });
  });

  it("explains a rule that is not allowed", async () => {
    const outcome = await executeTool(
      db,
      { name: "create_segment", input: { name: "Bad", match: "all", rules: [{ field: "status", op: "is", value: "paused" }] } },
      "2026-09-28",
    );

    expect(outcome).toMatchObject({ isError: true });
    expect(JSON.parse(outcome.content).error).toBe("Newsletter status is not an allowed value");
  });

  it("refuses a tool it does not have, and malformed input", async () => {
    expect((await executeTool(db, { name: "drop_tables", input: {} }, "2026-09-28")).isError).toBe(true);
    expect((await executeTool(db, { name: "run_query", input: { sql: 5 } }, "2026-09-28")).isError).toBe(true);
    expect((await executeTool(db, { name: "create_segment", input: {} }, "2026-09-28")).isError).toBe(true);
  });
});
