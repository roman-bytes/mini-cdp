/** Formats a count for display, e.g. 8441 -> "8,441". */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}
