/** Reads a required setting, with an error that says how to fix it. */
export function requireEnv(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}
