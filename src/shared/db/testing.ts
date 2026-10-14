import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { Db } from "./client";
import { MIGRATIONS_FOLDER } from "./migrations";

/**
 * A fresh, empty Postgres for one test, with every migration applied. It runs
 * in memory inside the test process, so tests need no database server.
 */
export async function createTestDb(): Promise<Db> {
  const db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}
