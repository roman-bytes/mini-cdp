import {
  findOrCreatePeopleByIdentifiers,
  linkIdentifiers,
  type PersonIdByValue,
} from "@/apps/people/identifiers";
import { upsertInChunks } from "@/shared/db/bulk";
import type { Db } from "@/shared/db/client";
import { fileLineNumber, loaded, merged, setAside, type RowResult } from "@/shared/raw/outcomes";
import { replaceRawRows } from "@/shared/raw/replace-rows";

import { cleanAppUserRow, type CleanAppUser, type RawAppUserRow } from "./app-user-rows";
import { accounts, rawAppUsers } from "./schema";

/** What the importer decided for one source row. */
type PlannedRow = {
  result: RowResult;
  /** The cleaned email, when the row had a usable one. */
  email: string | null;
};

export type AppUserImportPlan = {
  /** One cleaned account per distinct user ID. */
  appUsers: CleanAppUser[];
  /** One entry per source row, in file order. */
  rows: PlannedRow[];
};

/**
 * Decides what happens to every row, without touching the database. A user ID
 * that appears twice keeps its first row; later ones are marked as merged.
 */
export function planAppUserImport(rows: RawAppUserRow[]): AppUserImportPlan {
  const firstLineByUserId = new Map<string, number>();
  const appUsers: CleanAppUser[] = [];

  const planned = rows.map((row, index): PlannedRow => {
    const check = cleanAppUserRow(row);
    if (!check.ok) return { result: setAside(check.reason), email: null };

    const { userId, email } = check.appUser;
    const earlierLine = firstLineByUserId.get(userId);
    if (earlierLine !== undefined) {
      return { result: merged(`Duplicate of line ${earlierLine}`), email };
    }

    firstLineByUserId.set(userId, fileLineNumber(index));
    appUsers.push(check.appUser);
    return { result: loaded(), email };
  });

  return { appUsers, rows: planned };
}

async function linkUserIds(
  db: Db,
  appUsers: CleanAppUser[],
  personIds: PersonIdByValue,
): Promise<void> {
  const links = appUsers.map((appUser) => ({
    personId: personIds.get(appUser.email)!,
    type: "user_id" as const,
    value: appUser.userId,
  }));
  await linkIdentifiers(db, links, "mobile");
}

async function saveAccounts(
  db: Db,
  appUsers: CleanAppUser[],
  personIds: PersonIdByValue,
): Promise<void> {
  const rows = appUsers.map((appUser) => ({
    userId: appUser.userId,
    personId: personIds.get(appUser.email)!,
    createdOn: appUser.createdOn,
  }));
  await upsertInChunks(db, accounts, rows, accounts.userId, ["personId", "createdOn"]);
}

function toRawRows(rows: RawAppUserRow[], plan: AppUserImportPlan, personIds: PersonIdByValue) {
  return rows.map((row, index) => {
    const { result, email } = plan.rows[index];
    return {
      rowNumber: fileLineNumber(index),
      outcome: result.outcome,
      reason: result.reason,
      personId: email ? (personIds.get(email) ?? null) : null,
      userId: row.user_id,
      email: row.email,
      createdAt: row.created_at,
    };
  });
}

/**
 * Loads app_users.csv. Each account's email resolves to a person (a new,
 * app-only person when no subscriber has that email), and the account's user
 * ID is linked to that person so app events can find them later.
 */
export async function importAppUsers(db: Db, rows: RawAppUserRow[]): Promise<void> {
  const plan = planAppUserImport(rows);
  const emails = plan.appUsers.map((appUser) => appUser.email);
  const personIds = await findOrCreatePeopleByIdentifiers(db, "email", emails, "mobile");

  await linkUserIds(db, plan.appUsers, personIds);
  await saveAccounts(db, plan.appUsers, personIds);
  await replaceRawRows(db, rawAppUsers, toRawRows(rows, plan, personIds));
}
