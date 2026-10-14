import { asc, count, countDistinct, eq, isNull, ne } from "drizzle-orm";

import { accounts, rawAppUsers } from "@/apps/mobile/schema";
import { rawSubscribers, subscriptions } from "@/apps/newsletter/schema";
import { rawWebEvents, visits } from "@/apps/web/schema";
import type { Db } from "@/shared/db/client";
import type { RowOutcome } from "@/shared/raw/schema";

import { IMPORT_FILE_NAMES } from "./read-files";

/** How many rows of one source file ended up with each outcome. */
export type FileOutcomeCounts = {
  file: string;
  total: number;
  loaded: number;
  merged: number;
  setAside: number;
};

/** A source row that was merged or set aside, and why. */
export type ImportIssue = {
  file: string;
  rowNumber: number;
  outcome: RowOutcome;
  reason: string | null;
  /** The row's main value as written (email or visitor ID), to help find it. */
  value: string | null;
};

/** The headline numbers that show the import linked things correctly. */
export type ImportChecks = {
  subscriberProfiles: number;
  duplicateRowsMerged: number;
  rowsSetAside: number;
  appAccountsLinkedToSubscriber: number;
  appOnlyProfiles: number;
  webVisitsAttachedToSubscriber: number;
  webVisitsAnonymous: number;
};

export type ImportReport = {
  files: FileOutcomeCounts[];
  checks: ImportChecks;
  issues: ImportIssue[];
};

type OutcomeRow = { outcome: RowOutcome; total: number };

/** Turns "outcome, count" rows into one tally for a file. */
export function tallyOutcomes(file: string, rows: OutcomeRow[]): FileOutcomeCounts {
  const totalFor = (outcome: RowOutcome) =>
    rows.find((row) => row.outcome === outcome)?.total ?? 0;

  const tally = {
    file,
    loaded: totalFor("loaded"),
    merged: totalFor("merged"),
    setAside: totalFor("set_aside"),
  };
  return { ...tally, total: tally.loaded + tally.merged + tally.setAside };
}

/** The raw table behind each source file, and the column that identifies a row. */
const RAW_SOURCES = [
  { file: IMPORT_FILE_NAMES.subscribers, table: rawSubscribers, valueColumn: rawSubscribers.email },
  { file: IMPORT_FILE_NAMES.appUsers, table: rawAppUsers, valueColumn: rawAppUsers.email },
  { file: IMPORT_FILE_NAMES.webEvents, table: rawWebEvents, valueColumn: rawWebEvents.visitorId },
];
type RawSource = (typeof RAW_SOURCES)[number];

async function countOutcomes(db: Db, source: RawSource): Promise<FileOutcomeCounts> {
  const rows = await db
    .select({ outcome: source.table.outcome, total: count() })
    .from(source.table)
    .groupBy(source.table.outcome);
  return tallyOutcomes(source.file, rows);
}

async function getFileCounts(db: Db): Promise<FileOutcomeCounts[]> {
  const files: FileOutcomeCounts[] = [];
  for (const source of RAW_SOURCES) {
    files.push(await countOutcomes(db, source));
  }
  return files;
}

/** The rows of one source file that were merged or set aside, in file order. */
async function findIssues(db: Db, source: RawSource): Promise<ImportIssue[]> {
  const rows = await db
    .select({
      rowNumber: source.table.rowNumber,
      outcome: source.table.outcome,
      reason: source.table.reason,
      value: source.valueColumn,
    })
    .from(source.table)
    .where(ne(source.table.outcome, "loaded"))
    .orderBy(asc(source.table.rowNumber));
  return rows.map((row) => ({ file: source.file, ...row }));
}

async function getIssues(db: Db): Promise<ImportIssue[]> {
  const issues: ImportIssue[] = [];
  for (const source of RAW_SOURCES) {
    issues.push(...(await findIssues(db, source)));
  }
  return issues;
}

/** Adds one field of the per-file tallies across all files. */
function sumAcrossFiles(
  files: FileOutcomeCounts[],
  field: "merged" | "setAside",
): number {
  return files.reduce((sum, file) => sum + file[field], 0);
}

async function getChecks(db: Db, files: FileOutcomeCounts[]): Promise<ImportChecks> {
  const [subscribers] = await db.select({ total: count() }).from(subscriptions);
  const [linkedAccounts] = await db
    .select({ total: count() })
    .from(accounts)
    .innerJoin(subscriptions, eq(accounts.personId, subscriptions.personId));
  const [appOnly] = await db
    .select({ total: countDistinct(accounts.personId) })
    .from(accounts)
    .leftJoin(subscriptions, eq(accounts.personId, subscriptions.personId))
    .where(isNull(subscriptions.personId));
  const [attachedVisits] = await db
    .select({ total: count() })
    .from(visits)
    .innerJoin(subscriptions, eq(visits.personId, subscriptions.personId));
  const [anonymousVisits] = await db
    .select({ total: count() })
    .from(visits)
    .where(isNull(visits.personId));

  return {
    subscriberProfiles: subscribers.total,
    duplicateRowsMerged: sumAcrossFiles(files, "merged"),
    rowsSetAside: sumAcrossFiles(files, "setAside"),
    appAccountsLinkedToSubscriber: linkedAccounts.total,
    appOnlyProfiles: appOnly.total,
    webVisitsAttachedToSubscriber: attachedVisits.total,
    webVisitsAnonymous: anonymousVisits.total,
  };
}

/** Everything the Import report page shows, read live from the database. */
export async function getImportReport(db: Db): Promise<ImportReport> {
  const files = await getFileCounts(db);
  return {
    files,
    checks: await getChecks(db, files),
    issues: await getIssues(db),
  };
}
