import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { cache } from "react";

import { requireEnv } from "../env";
import { withExplicitSslMode } from "./connection";

/**
 * Any Drizzle Postgres database or open transaction. Every data function
 * takes one of these as its first argument, so the same function runs against
 * the hosted database, inside a transaction, or against the test database.
 */
export type Db = PgDatabase<PgQueryResultHKT>;

/** The connection string, with SSL spelled out so pg does not warn about it. */
function connectionString(): string {
  return withExplicitSslMode(requireEnv("DATABASE_URL"));
}

/**
 * True on Cloudflare Workers. A Worker may not reuse a connection opened by
 * another request, so there each request gets its own.
 */
export function isCloudflareWorker(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

// Next.js reloads modules in development. Keeping the pool on globalThis
// stops each reload from opening another set of connections.
const globalStore = globalThis as typeof globalThis & { cdpPool?: Pool };

function getSharedPool(): Pool {
  globalStore.cdpPool ??= new Pool({ connectionString: connectionString() });
  return globalStore.cdpPool;
}

/**
 * One database per request on Workers. React's cache keeps it for the rest of
 * the request; each connection is closed after one use, so none outlives it.
 */
const getRequestDb = cache((): Db => drizzle(new Pool({ connectionString: connectionString(), maxUses: 1 })));

/** The app's database connection, opened on first use. */
export function getDb(): Db {
  return isCloudflareWorker() ? getRequestDb() : drizzle(getSharedPool());
}

/** Closes the connection pool. Scripts call this so the process can exit. */
export async function closeDb(): Promise<void> {
  await globalStore.cdpPool?.end();
  globalStore.cdpPool = undefined;
}
