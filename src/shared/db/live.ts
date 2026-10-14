import { connection } from "next/server";

import { getDb, type Db } from "./client";

/**
 * The database for a page or route that must show live data. It waits for a
 * real request first, so nothing is queried or baked in while the app builds
 * and every request reads the current rows.
 */
export async function getLiveDb(): Promise<Db> {
  await connection();
  return getDb();
}
