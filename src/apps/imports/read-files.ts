import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { APP_USER_COLUMNS, type RawAppUserRow } from "@/apps/mobile/app-user-rows";
import { SUBSCRIBER_COLUMNS, type RawSubscriberRow } from "@/apps/newsletter/subscriber-rows";
import { WEB_EVENT_COLUMNS, type RawWebEventRow } from "@/apps/web/web-event-rows";
import { parseCsv, requireColumns } from "@/shared/csv";

/** The three source files, parsed but otherwise untouched. */
export type ImportFiles = {
  subscribers: RawSubscriberRow[];
  appUsers: RawAppUserRow[];
  webEvents: RawWebEventRow[];
};

export const IMPORT_FILE_NAMES = {
  subscribers: "subscribers.csv",
  appUsers: "app_users.csv",
  webEvents: "web_events.csv",
} as const;

/** Reads one CSV file and checks it has the columns its importer needs. */
async function readCsvFile<TRow>(
  directory: string,
  fileName: string,
  columns: readonly string[],
): Promise<TRow[]> {
  const text = await readFile(join(directory, fileName), "utf8");
  const rows = parseCsv(text);
  requireColumns(fileName, rows, columns);
  return rows as TRow[];
}

/** Reads the three source files from a directory. */
export async function readImportFiles(directory: string): Promise<ImportFiles> {
  return {
    subscribers: await readCsvFile(directory, IMPORT_FILE_NAMES.subscribers, SUBSCRIBER_COLUMNS),
    appUsers: await readCsvFile(directory, IMPORT_FILE_NAMES.appUsers, APP_USER_COLUMNS),
    webEvents: await readCsvFile(directory, IMPORT_FILE_NAMES.webEvents, WEB_EVENT_COLUMNS),
  };
}
