/**
 * The UI login gate: one shared password, checked on the server, that grants a
 * signed session cookie. The password is never stored in the cookie; the cookie
 * holds only the time it was issued and an HMAC of that time, so it cannot be
 * forged without the secret and cannot be used past its age limit.
 *
 * Everything here uses the Web Crypto API, so the same code runs in Next
 * middleware, in server actions, on Cloudflare Workers and under Node in tests.
 */

const encoder = new TextEncoder();

/** The cookie that proves a browser has signed in. */
export const SESSION_COOKIE = "cdp_session";

/** How long a session lasts before the password must be entered again. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(secret: string, message: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(message));
}

/** A constant-time check that `signature` is HMAC(secret, message). */
async function signatureMatches(secret: string, message: string, signature: BufferSource): Promise<boolean> {
  return crypto.subtle.verify("HMAC", await hmacKey(secret), signature, encoder.encode(message));
}

/**
 * A fresh session token: the issue time and its signature. Throws when the
 * secret is missing, so a misconfigured server fails at login rather than
 * handing out a cookie it can never verify.
 */
export async function createSessionToken(
  now: Date = new Date(),
  secret = process.env.AUTH_SECRET,
): Promise<string> {
  if (!secret) throw new Error('AUTH_SECRET is not set. Set it with "npx wrangler secret put AUTH_SECRET".');
  const issuedAt = String(now.getTime());
  const signature = Buffer.from(await sign(secret, issuedAt)).toString("base64url");
  return `${issuedAt}.${signature}`;
}

/**
 * Whether a cookie value is a signature this server made and is still young
 * enough. Anything wrong — missing, malformed, tampered, signed with another
 * secret, expired, or a missing secret — is a plain false, so the gate fails
 * closed.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  now: Date = new Date(),
  secret = process.env.AUTH_SECRET,
): Promise<boolean> {
  if (!token || !secret) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const issuedAt = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(issuedAt) || signature === "") return false;

  try {
    const ok = await signatureMatches(secret, issuedAt, Buffer.from(signature, "base64url"));
    if (!ok) return false;
  } catch {
    return false;
  }

  const age = now.getTime() - Number(issuedAt);
  return age >= 0 && age < SESSION_MAX_AGE_MS;
}

/**
 * A constant-time comparison of a submitted password against the configured
 * one. Both are run through HMAC with the secret first, so neither the length
 * nor the content of the real password leaks through timing. No configured
 * password or secret means no one can sign in.
 */
export async function checkPassword(
  input: string,
  password = process.env.APP_PASSWORD,
  secret = process.env.AUTH_SECRET,
): Promise<boolean> {
  if (!password || !secret || input.length === 0) return false;
  const inputSignature = await sign(secret, input);
  return signatureMatches(secret, password, inputSignature);
}

/**
 * A redirect target that can only point within this app. Anything that could
 * send the browser to another site (a full URL, a protocol-relative "//host",
 * a "/\\host" trick, or control characters) falls back to the home page.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
