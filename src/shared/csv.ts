import { parse } from "csv-parse/sync";

/** One data row of a CSV file: column name to the value exactly as written. */
export type CsvRow = Record<string, string>;

/**
 * Parses CSV text that starts with a header row. Values are not trimmed or
 * changed, and blank rows are kept, so the raw layer stores what the source
 * actually sent.
 */
export function parseCsv(text: string): CsvRow[] {
  return parse(text, { columns: true, bom: true }) as CsvRow[];
}

/** Throws when a file is missing a column the importer needs. */
export function requireColumns(
  fileName: string,
  rows: CsvRow[],
  columns: readonly string[],
): void {
  if (rows.length === 0) return;
  const missing = columns.filter((column) => !(column in rows[0]));
  if (missing.length > 0) {
    throw new Error(`${fileName} is missing column(s): ${missing.join(", ")}`);
  }
}

export type CsvValue = string | number | boolean | null;

/** Writes one value so that commas, quotes and line breaks survive. */
function csvCell(value: CsvValue): string {
  let text = value === null ? "" : String(value);
  // A spreadsheet runs a cell that starts with one of these as a formula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Builds CSV text from a header row and data rows. */
export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
