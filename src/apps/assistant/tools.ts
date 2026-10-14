import { findField, SEGMENT_FIELDS, type SegmentRule } from "@/apps/segments/definition";
import { saveCheckedSegment } from "@/apps/segments/preview";
import { countSegment } from "@/apps/segments/run";
import { getSegment } from "@/apps/segments/saved";
import type { Db } from "@/shared/db/client";

import type { ToolSpec } from "./conversation";
import { runReadOnlyQuery } from "./query";
import type { AssistantOutput } from "./schema";

/** How many rows of a query result go back to the model. The teammate's table keeps more. */
export const ROWS_SHOWN_TO_MODEL = 50;

/** The two things the model can do. Both are checked on the server before anything runs. */
export const ASSISTANT_TOOLS: ToolSpec[] = [
  {
    name: "run_query",
    description:
      "Run one read-only PostgreSQL SELECT against the views described in the system prompt and get the rows back. The teammate sees the same result as a table under your answer. Include person_key whenever the rows are individual people.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "A short plain-English title for the table." },
        sql: { type: "string", description: "One PostgreSQL SELECT statement." },
      },
      required: ["title", "sql"],
    },
  },
  {
    name: "create_segment",
    description:
      "Save a segment: a reusable list of people picked by rules, which the teammate can open, export and reuse. Rules may use only the fields and operators listed in the system prompt. Returns the segment's size.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "A short name for the segment." },
        match: { type: "string", enum: ["all", "any"], description: "all = every rule must match; any = at least one." },
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string", enum: SEGMENT_FIELDS.map((field) => field.field) },
              op: { type: "string" },
              value: {
                type: "string",
                description: "The value as text: digits for numbers, YYYY-MM-DD for dates, empty when the operator takes no value.",
              },
            },
            required: ["field", "op", "value"],
          },
        },
      },
      required: ["name", "match", "rules"],
    },
  },
];

/** What running one tool produced: the reply for the model, and anything to show the teammate. */
export type ToolOutcome = {
  content: string;
  isError: boolean;
  output?: AssistantOutput;
};

function failure(message: string): ToolOutcome {
  return { content: JSON.stringify({ error: message }), isError: true };
}

/** Turns a rule as the model sends it (every value as text) into a segment rule. */
export function toSegmentRule(input: { field: string; op: string; value: string }): SegmentRule {
  const operator = findField(input.field)?.operators.find((candidate) => candidate.op === input.op);
  const text = input.value.trim();
  if (operator?.value === "none" || text === "") return { field: input.field, op: input.op };
  if (operator?.value === "number") return { field: input.field, op: input.op, value: Number(text) };
  return { field: input.field, op: input.op, value: text };
}

async function runQueryTool(db: Db, input: { title?: unknown; sql?: unknown }): Promise<ToolOutcome> {
  if (typeof input.sql !== "string" || typeof input.title !== "string") {
    return failure("run_query needs a title and an sql string.");
  }
  const result = await runReadOnlyQuery(db, input.sql);
  if (!result.ok) return failure(result.error);

  const shownRows = result.rows.slice(0, ROWS_SHOWN_TO_MODEL);
  return {
    isError: false,
    content: JSON.stringify({
      columns: result.columns,
      rows: shownRows,
      total_rows: result.totalRows,
      ...(result.totalRows > shownRows.length ? { note: `Showing ${shownRows.length} of ${result.totalRows} rows.` } : {}),
    }),
    output: { kind: "table", title: input.title, columns: result.columns, rows: result.rows, totalRows: result.totalRows },
  };
}

type SegmentInput = { name?: unknown; match?: unknown; rules?: unknown };

async function createSegmentTool(db: Db, input: SegmentInput, today: string): Promise<ToolOutcome> {
  if (typeof input.name !== "string" || !Array.isArray(input.rules)) {
    return failure("create_segment needs a name, a match mode and a list of rules.");
  }
  const definition = {
    match: input.match,
    rules: (input.rules as { field: string; op: string; value: string }[]).map(toSegmentRule),
  };
  const saved = await saveCheckedSegment(db, input.name, definition);
  if (!saved.ok) return failure(saved.errors.join("; "));

  const segment = (await getSegment(db, saved.id))!;
  const size = await countSegment(db, segment.definition, today);
  return {
    isError: false,
    content: JSON.stringify({ segment_id: saved.id, name: segment.name, people: size.total, never_opened: size.neverOpened }),
    output: { kind: "segment", segmentId: saved.id, name: segment.name, total: size.total, neverOpened: size.neverOpened },
  };
}

/** Runs one tool call from the model. A bad call becomes an error the model can read and fix. */
export async function executeTool(
  db: Db,
  toolUse: { name: string; input: unknown },
  today: string,
): Promise<ToolOutcome> {
  const input = (toolUse.input ?? {}) as Record<string, unknown>;
  if (toolUse.name === "run_query") return runQueryTool(db, input);
  if (toolUse.name === "create_segment") return createSegmentTool(db, input, today);
  return failure(`There is no tool called ${toolUse.name}.`);
}
