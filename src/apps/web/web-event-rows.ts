import { normalizeChannel } from "@/shared/channels";
import { parseUtcTimestamp } from "@/shared/dates";
import { isValidEmail, normalizeEmail } from "@/shared/email";

/** The columns of web_events.csv. */
export const WEB_EVENT_COLUMNS = ["visitor_id", "page", "timestamp", "utm_source", "email"] as const;

/** One row of web_events.csv, values exactly as written. */
export type RawWebEventRow = Record<(typeof WEB_EVENT_COLUMNS)[number], string>;

/** A page view after cleaning, ready to store. */
export type CleanVisit = {
  visitorId: string;
  page: string;
  occurredAt: Date;
  utmSource: string | null;
  /** The email captured on this visit, if it carried a usable one. */
  email: string | null;
};

export type WebEventCheck =
  | { ok: true; visit: CleanVisit }
  | { ok: false; reason: string };

/** A usable email from the row, or null. A bad email does not sink the visit. */
function cleanEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  return isValidEmail(email) ? email : null;
}

/** Checks one source row and, when it is usable, returns its cleaned form. */
export function cleanWebEventRow(row: RawWebEventRow): WebEventCheck {
  const visitorId = row.visitor_id.trim();
  if (visitorId === "") return { ok: false, reason: "Missing visitor ID" };

  const page = row.page.trim();
  if (page === "") return { ok: false, reason: "Missing page" };

  const occurredAt = parseUtcTimestamp(row.timestamp);
  if (!occurredAt) return { ok: false, reason: "Invalid timestamp" };

  return {
    ok: true,
    visit: {
      visitorId,
      page,
      occurredAt,
      utmSource: normalizeChannel(row.utm_source),
      email: cleanEmail(row.email),
    },
  };
}

/**
 * The email each visitor gave, keyed by visitor ID. A visitor who gave more
 * than one keeps the earliest, so a later typo cannot move their history.
 */
export function firstEmailByVisitor(visits: CleanVisit[]): Map<string, string> {
  const earliest = new Map<string, { email: string; at: number }>();
  for (const visit of visits) {
    if (!visit.email) continue;
    const at = visit.occurredAt.getTime();
    const current = earliest.get(visit.visitorId);
    if (!current || at < current.at) {
      earliest.set(visit.visitorId, { email: visit.email, at });
    }
  }
  return new Map([...earliest].map(([visitorId, entry]) => [visitorId, entry.email]));
}
