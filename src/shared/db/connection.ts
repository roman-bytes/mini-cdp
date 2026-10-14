/** SSL modes the pg driver currently treats as "verify-full", with a warning that this will change. */
const LEGACY_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * Spells out sslmode=verify-full where a connection string asks for prefer,
 * require or verify-ca. The pg driver already treats those as verify-full, so
 * this keeps today's (strictest) behaviour, silences the driver's warning,
 * and stops a future driver upgrade from quietly weakening the check.
 */
export function withExplicitSslMode(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return connectionString;
  }
  const mode = url.searchParams.get("sslmode");
  if (mode === null || !LEGACY_SSL_MODES.has(mode)) return connectionString;
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}
