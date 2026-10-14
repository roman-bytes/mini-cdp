import { normalizeChannel } from "@/shared/channels";
import { isIsoDate } from "@/shared/dates";
import { isValidEmail, normalizeEmail } from "@/shared/email";

import { SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "./schema";

/** The columns of subscribers.csv. */
export const SUBSCRIBER_COLUMNS = [
  "email",
  "signup_date",
  "status",
  "acquisition_source",
  "last_open_date",
] as const;

/** One row of subscribers.csv, values exactly as written. */
export type RawSubscriberRow = Record<(typeof SUBSCRIBER_COLUMNS)[number], string>;

/** A subscriber after cleaning, ready to store. */
export type CleanSubscriber = {
  email: string;
  status: SubscriptionStatus;
  acquisitionSource: string | null;
  signupDate: string;
  lastOpenDate: string | null;
};

export type SubscriberCheck =
  | { ok: true; subscriber: CleanSubscriber }
  | { ok: false; reason: string };

function isBlankRow(row: RawSubscriberRow): boolean {
  return SUBSCRIBER_COLUMNS.every((column) => row[column].trim() === "");
}

function isStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

/** Why a row cannot be loaded, or null when it is fine. */
function findProblem(row: RawSubscriberRow): string | null {
  if (isBlankRow(row)) return "Blank row";
  if (!isValidEmail(normalizeEmail(row.email))) return "Invalid email";
  if (!isStatus(row.status.trim().toLowerCase())) return "Unknown status";
  if (!isIsoDate(row.signup_date.trim())) return "Invalid signup date";
  const lastOpen = row.last_open_date.trim();
  if (lastOpen !== "" && !isIsoDate(lastOpen)) return "Invalid last open date";
  return null;
}

/** Checks one source row and, when it is usable, returns its cleaned form. */
export function cleanSubscriberRow(row: RawSubscriberRow): SubscriberCheck {
  const problem = findProblem(row);
  if (problem) return { ok: false, reason: problem };

  return {
    ok: true,
    subscriber: {
      email: normalizeEmail(row.email),
      status: row.status.trim().toLowerCase() as SubscriptionStatus,
      acquisitionSource: normalizeChannel(row.acquisition_source),
      signupDate: row.signup_date.trim(),
      lastOpenDate: row.last_open_date.trim() || null,
    },
  };
}

function earliest(a: string, b: string): string {
  return a <= b ? a : b;
}

function latest(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

/**
 * Combines two rows for the same email into one subscriber: earliest signup,
 * latest open, the first known source, and "unsubscribed" beats "active" so
 * nobody who opted out is ever treated as subscribed.
 */
export function mergeSubscribers(
  first: CleanSubscriber,
  second: CleanSubscriber,
): CleanSubscriber {
  const eitherUnsubscribed =
    first.status === "unsubscribed" || second.status === "unsubscribed";

  return {
    email: first.email,
    status: eitherUnsubscribed ? "unsubscribed" : "active",
    acquisitionSource: first.acquisitionSource ?? second.acquisitionSource,
    signupDate: earliest(first.signupDate, second.signupDate),
    lastOpenDate: latest(first.lastOpenDate, second.lastOpenDate),
  };
}
