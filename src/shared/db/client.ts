import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import { requireEnv } from "../env";
import { withExplicitSslMode } from "./connection";

/**
 * Any Drizzle Postgres database or open transaction. Every data function
 * takes one of these as its first argument, so the same function runs against
 * the hosted database, inside a transaction, or against the test database.
 */
export type Db = PgDatabase<PgQueryResultHKT>;

// Next.js reloads modules in development. Keeping the pool on globalThis
// stops each reload from opening another set of connections.
const globalStore = globalThis as typeof globalThis & { cdpPool?: Pool };

function getPool(): Pool {
  globalStore.cdpPool ??= new Pool({
    connectionString: withExplicitSslMode(requireEnv("DATABASE_URL")),
  });
  return globalStore.cdpPool;
}

/** The app's database connection, opened on first use. */
export function getDb(): Db {
  return drizzle(getPool());
}

/** Closes the connection pool. Scripts call this so the process can exit. */
export async function closeDb(): Promise<void> {
  await globalStore.cdpPool?.end();
  globalStore.cdpPool = undefined;
}
