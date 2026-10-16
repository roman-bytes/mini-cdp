"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { consumeRateLimit, type RateLimit } from "@/shared/auth/rate-limit";
import {
  checkPassword,
  createSessionToken,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/shared/auth/session";
import { getDb } from "@/shared/db/client";

/** Slow down password guessing: ten tries per source every five minutes. */
const LOGIN_RATE_LIMIT: RateLimit = { limit: 10, windowSeconds: 300 };

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Who is being counted for rate limiting: the caller's IP, or a shared bucket. */
async function callerKey(): Promise<string> {
  const headerList = await headers();
  const ip =
    headerList.get("cf-connecting-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `login:${ip}`;
}

/**
 * Checks the shared password and, when it matches, sets the signed session
 * cookie and sends the browser on to where it was headed. A wrong password or
 * too many attempts returns to the form with a message.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const next = safeNextPath(formString(formData, "next"));

  const within = await consumeRateLimit(getDb(), await callerKey(), LOGIN_RATE_LIMIT);
  if (!within) redirect(`/login?error=rate&next=${encodeURIComponent(next)}`);

  if (!(await checkPassword(formString(formData, "password")))) {
    redirect(`/login?error=bad&next=${encodeURIComponent(next)}`);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(next);
}

/** Clears the session and returns to the login form. */
export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
