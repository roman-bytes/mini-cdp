import { importAppUsers } from "@/apps/mobile/import-app-users";
import { importSubscribers } from "@/apps/newsletter/import-subscribers";
import { importWebEvents } from "@/apps/web/import-web-events";
import type { Db } from "@/shared/db/client";

import type { ImportFiles } from "./read-files";

/**
 * Loads all three sources in one transaction, so a failure part-way leaves
 * the database exactly as it was. Safe to run again: people keep their IDs
 * and nothing is duplicated.
 *
 * Subscribers go first so that app accounts and web visitors resolve to the
 * people the newsletter already knows.
 */
export async function runImport(db: Db, files: ImportFiles): Promise<void> {
  await db.transaction(async (tx) => {
    await importSubscribers(tx, files.subscribers);
    await importAppUsers(tx, files.appUsers);
    await importWebEvents(tx, files.webEvents);
  });
}
