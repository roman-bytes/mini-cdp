import { integer, jsonb, pgSchema, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Assistant owns the questions asked, the answers given, and the record of what the model saw. */
export const assistantSchema = pgSchema("assistant");

export const RUN_STATUSES = ["running", "answered", "blocked", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** A table the assistant produced, as rows of plain values. */
export type AssistantTable = {
  kind: "table";
  title: string;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  /** All matching rows, including any beyond those kept here. */
  totalRows: number;
};

/** A segment the assistant saved. */
export type AssistantSegment = {
  kind: "segment";
  segmentId: string;
  name: string;
  total: number;
  neverOpened: number;
};

export type AssistantOutput = AssistantTable | AssistantSegment;

/** A text that was swapped out of the question before it reached the model. */
export type Replacement = { original: string; replacement: string };

/** One question and its answer. */
export const runs = assistantSchema.table("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** As the teammate typed it. Stays in this database; never sent to the model. */
  question: text("question").notNull(),
  /** What the model was given, after anything identifying was swapped out. */
  sentQuestion: text("sent_question").notNull(),
  replacements: jsonb("replacements").$type<Replacement[]>().notNull().default([]),
  status: text("status", { enum: RUN_STATUSES }).notNull(),
  answer: text("answer"),
  outputs: jsonb("outputs").$type<AssistantOutput[]>().notNull().default([]),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * Every request sent to the model, exactly as sent, and its reply. This is
 * the "What the AI saw" record, and what the privacy tests scan.
 */
export const modelCalls = assistantSchema.table("model_calls", {
  id: serial("id").primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  step: integer("step").notNull(),
  request: jsonb("request").notNull(),
  /** Null when the request was blocked before it was sent. */
  response: jsonb("response"),
  /** Anything that looked identifying in the request. Empty means it passed. */
  piiFindings: jsonb("pii_findings").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
