import type { PgTable } from "drizzle-orm/pg-core";

import { insertInChunks } from "../db/bulk";
import type { Db } from "../db/client";

/**
 * Replaces a raw table's contents with the rows from the latest file. A raw
 * table always mirrors the most recent import of its source.
 */
export async function replaceRawRows<TTable extends PgTable>(
  db: Db,
  table: TTable,
  rows: TTable["$inferInsert"][],
): Promise<void> {
  await db.delete(table);
  await insertInChunks(db, table, rows);
}
