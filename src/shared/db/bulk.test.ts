import { asc, count } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { accounts } from "@/apps/mobile/schema";
import { findOrCreatePerson } from "@/apps/people/identifiers";
import { people } from "@/apps/people/schema";
import { rawAppUsers } from "@/apps/mobile/schema";
import { replaceRawRows } from "@/shared/raw/replace-rows";

import { INSERT_BATCH_SIZE, insertInChunks, upsertInChunks } from "./bulk";
import type { Db } from "./client";
import { createTestDb } from "./testing";

function rawRow(rowNumber: number) {
  return { rowNumber, outcome: "loaded" as const, userId: `u_${rowNumber}` };
}

describe("bulk writes", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("insertInChunks", () => {
    it("inserts more rows than fit in one statement", async () => {
      const rows = Array.from({ length: INSERT_BATCH_SIZE * 2 + 1 }, () => ({}));
      await insertInChunks(db, people, rows);

      const [result] = await db.select({ total: count() }).from(people);
      expect(result.total).toBe(INSERT_BATCH_SIZE * 2 + 1);
    });

    it("does nothing for an empty list", async () => {
      await insertInChunks(db, people, []);

      const [result] = await db.select({ total: count() }).from(people);
      expect(result.total).toBe(0);
    });
  });

  describe("upsertInChunks", () => {
    it("inserts a new row and overwrites the named columns of an existing one", async () => {
      const personId = await findOrCreatePerson(db, "email", "a@example.com", "mobile");
      const account = { userId: "u_1", personId, createdOn: "2026-08-01" };

      await upsertInChunks(db, accounts, [account], accounts.userId, ["createdOn"]);
      await upsertInChunks(
        db,
        accounts,
        [{ ...account, createdOn: "2026-09-01" }],
        accounts.userId,
        ["createdOn"],
      );

      expect(await db.select().from(accounts)).toEqual([
        { userId: "u_1", personId, createdOn: "2026-09-01" },
      ]);
    });

    it("leaves columns that are not named untouched", async () => {
      const first = await findOrCreatePerson(db, "email", "a@example.com", "mobile");
      const second = await findOrCreatePerson(db, "email", "b@example.com", "mobile");

      await upsertInChunks(
        db,
        accounts,
        [{ userId: "u_1", personId: first, createdOn: "2026-08-01" }],
        accounts.userId,
        ["createdOn"],
      );
      await upsertInChunks(
        db,
        accounts,
        [{ userId: "u_1", personId: second, createdOn: "2026-09-01" }],
        accounts.userId,
        ["createdOn"],
      );

      const [stored] = await db.select().from(accounts);
      expect(stored.personId).toBe(first);
    });
  });

  describe("replaceRawRows", () => {
    it("swaps the old rows for the new ones", async () => {
      await replaceRawRows(db, rawAppUsers, [rawRow(2), rawRow(3)]);
      await replaceRawRows(db, rawAppUsers, [rawRow(7)]);

      const stored = await db.select().from(rawAppUsers).orderBy(asc(rawAppUsers.rowNumber));
      expect(stored.map((row) => row.rowNumber)).toEqual([7]);
    });

    it("empties the table when the new file has no rows", async () => {
      await replaceRawRows(db, rawAppUsers, [rawRow(2)]);
      await replaceRawRows(db, rawAppUsers, []);

      expect(await db.select().from(rawAppUsers)).toEqual([]);
    });
  });
});
