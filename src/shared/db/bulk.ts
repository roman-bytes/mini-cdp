import { getTableColumns, sql, type SQL } from "drizzle-orm";
import type { IndexColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";

import { chunk } from "../collections";
import type { Db } from "./client";

/** Rows per INSERT statement. Keeps each statement well under Postgres limits. */
export const INSERT_BATCH_SIZE = 500;

/** Inserts many rows as a few multi-row statements instead of one per row. */
export async function insertInChunks<TTable extends PgTable>(
  db: Db,
  table: TTable,
  rows: TTable["$inferInsert"][],
): Promise<void> {
  for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
    await db.insert(table).values(batch);
  }
}

/**
 * The SET clause for an upsert: each named column takes the value from the
 * row that was about to be inserted.
 */
export function takeIncomingValues<TTable extends PgTable>(
  table: TTable,
  columnKeys: (keyof TTable["_"]["columns"] & string)[],
): Record<string, SQL> {
  const columns = getTableColumns(table);
  const assignments: Record<string, SQL> = {};
  for (const key of columnKeys) {
    assignments[key] = sql.raw(`excluded."${columns[key].name}"`);
  }
  return assignments;
}

/**
 * Inserts rows, and where a row with the same key already exists, overwrites
 * the named columns with the incoming values. Makes an import safe to re-run.
 */
export async function upsertInChunks<TTable extends PgTable>(
  db: Db,
  table: TTable,
  rows: TTable["$inferInsert"][],
  keyColumn: IndexColumn,
  updateKeys: (keyof TTable["_"]["columns"] & string)[],
): Promise<void> {
  const set = takeIncomingValues(table, updateKeys) as PgUpdateSetSource<TTable>;
  for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
    await db.insert(table).values(batch).onConflictDoUpdate({ target: keyColumn, set });
  }
}
