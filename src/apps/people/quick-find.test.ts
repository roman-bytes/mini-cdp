import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { QUICK_FIND_LIMIT, quickFind } from "./quick-find";

describe("quickFind, with the assessment files loaded", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    await runImport(db, await readImportFiles("data"));
  }, 120_000);

  it("finds a person by part of their email", async () => {
    const results = await quickFind(db, "julia.evans");

    expect(results[0]).toMatchObject({ email: "julia.evans230@gmail.com", kind: "subscriber", matched: null });
  });

  it("says which ID matched when it was not the email", async () => {
    const [result] = await quickFind(db, "U_2B6447A3");

    expect(result).toMatchObject({
      email: "julia.evans230@gmail.com",
      matched: { type: "user_id", value: "u_2b6447a3" },
    });
  });

  it("returns at most the limit", async () => {
    expect(await quickFind(db, "gmail")).toHaveLength(QUICK_FIND_LIMIT);
  });

  it("returns nothing for text that is too short", async () => {
    expect(await quickFind(db, " a ")).toEqual([]);
  });
});
