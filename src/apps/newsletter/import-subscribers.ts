import { findOrCreatePeopleByIdentifiers, type PersonIdByValue } from "@/apps/people/identifiers";
import { upsertInChunks } from "@/shared/db/bulk";
import type { Db } from "@/shared/db/client";
import { fileLineNumber, loaded, merged, setAside, type RowResult } from "@/shared/raw/outcomes";
import { replaceRawRows } from "@/shared/raw/replace-rows";

import { rawSubscribers, subscriptions } from "./schema";
import {
  cleanSubscriberRow,
  mergeSubscribers,
  type CleanSubscriber,
  type RawSubscriberRow,
} from "./subscriber-rows";

/** What the importer decided for one source row. */
type PlannedRow = {
  result: RowResult;
  /** The cleaned email, when the row had a usable one. */
  email: string | null;
};

export type SubscriberImportPlan = {
  /** One cleaned subscriber per distinct email. */
  subscribers: CleanSubscriber[];
  /** One entry per source row, in file order. */
  rows: PlannedRow[];
};

/**
 * Decides what happens to every row, without touching the database: load it,
 * merge it into an earlier row with the same email, or set it aside.
 */
export function planSubscriberImport(rows: RawSubscriberRow[]): SubscriberImportPlan {
  const firstSeen = new Map<string, { subscriber: CleanSubscriber; line: number }>();

  const planned = rows.map((row, index): PlannedRow => {
    const check = cleanSubscriberRow(row);
    if (!check.ok) return { result: setAside(check.reason), email: null };

    const { email } = check.subscriber;
    const earlier = firstSeen.get(email);
    if (!earlier) {
      firstSeen.set(email, { subscriber: check.subscriber, line: fileLineNumber(index) });
      return { result: loaded(), email };
    }

    earlier.subscriber = mergeSubscribers(earlier.subscriber, check.subscriber);
    return { result: merged(`Duplicate of line ${earlier.line}`), email };
  });

  return {
    subscribers: [...firstSeen.values()].map((entry) => entry.subscriber),
    rows: planned,
  };
}

async function saveSubscriptions(
  db: Db,
  subscribers: CleanSubscriber[],
  personIds: PersonIdByValue,
): Promise<void> {
  const rows = subscribers.map((subscriber) => ({
    personId: personIds.get(subscriber.email)!,
    status: subscriber.status,
    acquisitionSource: subscriber.acquisitionSource,
    signupDate: subscriber.signupDate,
    lastOpenDate: subscriber.lastOpenDate,
  }));
  await upsertInChunks(db, subscriptions, rows, subscriptions.personId, [
    "status",
    "acquisitionSource",
    "signupDate",
    "lastOpenDate",
  ]);
}

function toRawRows(
  rows: RawSubscriberRow[],
  plan: SubscriberImportPlan,
  personIds: PersonIdByValue,
) {
  return rows.map((row, index) => {
    const { result, email } = plan.rows[index];
    return {
      rowNumber: fileLineNumber(index),
      outcome: result.outcome,
      reason: result.reason,
      personId: email ? (personIds.get(email) ?? null) : null,
      email: row.email,
      signupDate: row.signup_date,
      status: row.status,
      acquisitionSource: row.acquisition_source,
      lastOpenDate: row.last_open_date,
    };
  });
}

/**
 * Loads subscribers.csv: one person and one subscription per distinct email,
 * with every source row kept in the raw layer alongside what happened to it.
 */
export async function importSubscribers(db: Db, rows: RawSubscriberRow[]): Promise<void> {
  const plan = planSubscriberImport(rows);
  const emails = plan.subscribers.map((subscriber) => subscriber.email);
  const personIds = await findOrCreatePeopleByIdentifiers(db, "email", emails, "newsletter");

  await saveSubscriptions(db, plan.subscribers, personIds);
  await replaceRawRows(db, rawSubscribers, toRawRows(rows, plan, personIds));
}
