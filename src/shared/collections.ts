/** Splits a list into consecutive pieces of at most `size` items. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be at least 1");
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

/** The distinct values of a list, in first-seen order. */
export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
