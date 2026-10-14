const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the text has the shape of a UUID, so it is safe to query by. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
