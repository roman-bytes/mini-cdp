import { integer, pgSchema, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * The raw layer: every source row exactly as it arrived, never edited.
 * Each app defines its own raw table here (see the app's schema.ts).
 */
export const rawSchema = pgSchema("raw");

/** What the importer did with a source row. */
export const ROW_OUTCOMES = ["loaded", "merged", "set_aside"] as const;
export type RowOutcome = (typeof ROW_OUTCOMES)[number];

/**
 * Columns every raw table has besides the source's own. A function, because
 * each table needs its own column objects.
 */
export function rawRowColumns() {
  return {
    id: serial("id").primaryKey(),
    /** Line in the source file; the header is line 1. */
    rowNumber: integer("row_number").notNull(),
    outcome: text("outcome", { enum: ROW_OUTCOMES }).notNull(),
    /** Why a row was merged or set aside. Empty for loaded rows. */
    reason: text("reason"),
    /** The person the row resolved to, when it resolved to one. */
    personId: uuid("person_id"),
    loadedAt: timestamp("loaded_at", { withTimezone: true }).notNull().defaultNow(),
  };
}
