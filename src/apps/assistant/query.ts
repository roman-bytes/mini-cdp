import { sql } from "drizzle-orm";

import type { Db } from "@/shared/db/client";

/** The most rows one query keeps. Anything past this is counted, not kept. */
export const QUERY_ROW_LIMIT = 500;

/** How long one query may run before Postgres stops it. */
export const QUERY_TIMEOUT_MS = 5000;

export type CellValue = string | number | boolean | null;

export type QueryResult =
  | { ok: true; columns: string[]; rows: CellValue[][]; totalRows: number }
  | { ok: false; error: string };

/**
 * Accepts exactly one statement, so the query can be wrapped in a SELECT.
 * A trailing semicolon is fine; any other semicolon is not.
 */
export function checkSingleStatement(query: string): string | null {
  const body = query.trim().replace(/;\s*$/, "");
  if (body === "") return null;
  return body.includes(";") ? null : body;
}

/** Makes a database value safe to send as JSON. */
export function toCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  return JSON.stringify(value);
}

type RawResult = { rows: Record<string, unknown>[]; fields?: { name: string }[] };

/** The text of a database error, without a stack trace. */
function errorMessage(error: unknown): string {
  const cause = (error as { cause?: { message?: string } })?.cause;
  return cause?.message ?? (error instanceof Error ? error.message : String(error));
}

/**
 * Runs SQL the model wrote, with four locks on it:
 * 1. one statement only, wrapped in SELECT, so it can only read;
 * 2. a read-only transaction, so even a write inside it fails;
 * 3. the ai_reader role, which can see the PII-free "ai" views and nothing else;
 * 4. a time limit, and a cap on the rows kept.
 * Postgres turns each row into JSON itself, so dates and numbers come back in
 * the same form whichever database driver is in use.
 */
export async function runReadOnlyQuery(db: Db, query: string): Promise<QueryResult> {
  const body = checkSingleStatement(query);
  if (!body) return { ok: false, error: "Send exactly one SQL statement." };

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`set transaction read only`);
      await tx.execute(sql`set local role ai_reader`);
      await tx.execute(sql.raw(`set local statement_timeout = ${QUERY_TIMEOUT_MS}`));
      await tx.execute(sql`set local search_path = ai`);
      await tx.execute(sql`set local timezone = 'UTC'`);

      const rows = (await tx.execute(
        sql.raw(`select row_to_json(answer) as row from (${body}) as answer limit ${QUERY_ROW_LIMIT + 1}`),
      )) as unknown as RawResult;
      const total = (await tx.execute(
        sql.raw(`select count(*)::int as total from (${body}) as answer`),
      )) as unknown as RawResult;
      const shape = (await tx.execute(
        sql.raw(`select * from (${body}) as answer limit 0`),
      )) as unknown as RawResult;

      return {
        rows: rows.rows.map((row) => row.row as Record<string, unknown>),
        columns: shape.fields?.map((field) => field.name) ?? [],
        total: Number(total.rows[0]?.total ?? 0),
      };
    });

    const columns = result.columns.length > 0 ? result.columns : Object.keys(result.rows[0] ?? {});
    const rows = result.rows
      .slice(0, QUERY_ROW_LIMIT)
      .map((row) => columns.map((column) => toCellValue(row[column])));
    return { ok: true, columns, rows, totalRows: result.total };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
