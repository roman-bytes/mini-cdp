import type { RowOutcome } from "./schema";

/** The importer's verdict on one source row. */
export type RowResult = {
  outcome: RowOutcome;
  reason: string | null;
};

export function loaded(): RowResult {
  return { outcome: "loaded", reason: null };
}

export function merged(reason: string): RowResult {
  return { outcome: "merged", reason };
}

export function setAside(reason: string): RowResult {
  return { outcome: "set_aside", reason };
}

/** Header is line 1, so the first data row is line 2. */
export function fileLineNumber(dataRowIndex: number): number {
  return dataRowIndex + 2;
}
