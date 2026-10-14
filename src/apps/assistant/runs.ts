import { asc, desc, eq } from "drizzle-orm";

import { listEmailsForPeople } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { isUuid } from "@/shared/ids";

import { modelCalls, runs, type AssistantTable } from "./schema";

export type Run = typeof runs.$inferSelect;
export type ModelCall = typeof modelCalls.$inferSelect;

/** One run with every request it sent to the model, in order. */
export async function getRun(db: Db, id: string): Promise<{ run: Run; calls: ModelCall[] } | null> {
  if (!isUuid(id)) return null;
  const [run] = await db.select().from(runs).where(eq(runs.id, id));
  if (!run) return null;
  const calls = await db.select().from(modelCalls).where(eq(modelCalls.runId, id)).orderBy(asc(modelCalls.step));
  return { run, calls };
}

/** The latest questions, newest first. */
export async function listRecentRuns(db: Db, limit = 10): Promise<Run[]> {
  return db.select().from(runs).orderBy(desc(runs.createdAt)).limit(limit);
}

export type PrivacySummary = {
  requestsSent: number;
  requestsBlocked: number;
  findings: string[];
};

/** How many requests went to the model, and whether any was stopped for containing PII. */
export function summarisePrivacy(calls: ModelCall[]): PrivacySummary {
  const blocked = calls.filter((call) => call.piiFindings.length > 0);
  return {
    requestsSent: calls.filter((call) => call.response !== null).length,
    requestsBlocked: blocked.length,
    findings: [...new Set(blocked.flatMap((call) => call.piiFindings))],
  };
}

/** A table as the teammate sees it: person keys turned back into people. */
export type TeammateTable = {
  title: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  /** For each row, the person it is about, when the table lists people. */
  personIds: (string | null)[];
  totalRows: number;
};

export const PERSON_KEY_COLUMN = "person_key";

/**
 * Swaps the person_key column for the person's email, for the signed-in
 * teammate's eyes only. This happens after the model is finished; the emails
 * are never part of anything sent to it.
 */
export async function prepareTableForTeammate(db: Db, table: AssistantTable): Promise<TeammateTable> {
  const keyIndex = table.columns.indexOf(PERSON_KEY_COLUMN);
  if (keyIndex === -1) {
    return { ...table, personIds: table.rows.map(() => null) };
  }

  const personIds = table.rows.map((row) => (typeof row[keyIndex] === "string" ? (row[keyIndex] as string) : null));
  const emails = await listEmailsForPeople(db, personIds.filter((id): id is string => id !== null));

  return {
    title: table.title,
    totalRows: table.totalRows,
    columns: table.columns.map((column, index) => (index === keyIndex ? "person" : column)),
    rows: table.rows.map((row, rowIndex) =>
      row.map((cell, index) => {
        if (index !== keyIndex) return cell;
        const personId = personIds[rowIndex];
        return personId ? (emails.get(personId) ?? "No email on file") : "Anonymous";
      }),
    ),
    personIds,
  };
}
