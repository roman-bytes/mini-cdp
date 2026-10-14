import { desc, inArray, max } from "drizzle-orm";

import type { Db } from "@/shared/db/client";

import { events, rawWebhookEvents, type DeliveryOutcome, type DeliverySource } from "./schema";

/** The parts of a delivery body worth showing. Any of them can be missing from a refused one. */
export type DeliveryBodyFields = {
  eventId: string | null;
  event: string | null;
  userId: string | null;
  deviceId: string | null;
};

/** One line of the activity log. */
export type DeliveryLogEntry = DeliveryBodyFields & {
  id: number;
  receivedAt: Date;
  source: DeliverySource;
  outcome: DeliveryOutcome;
  /** Why it was refused. Null when it was stored. */
  reason: string | null;
  /** The person the event belongs to now. Null while anonymous, and for refused deliveries. */
  personId: string | null;
};

const NO_FIELDS: DeliveryBodyFields = { eventId: null, event: null, userId: null, deviceId: null };

/** A field of the body when it is text, or null when it is missing or not text. */
function textField(body: Record<string, unknown>, name: string): string | null {
  const value = body[name];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Reads the useful fields out of a delivery body exactly as it arrived. A
 * refused delivery may not be JSON or may have the wrong shape, so nothing
 * here throws.
 */
export function readDeliveryBody(body: string): DeliveryBodyFields {
  let decoded: unknown;
  try {
    decoded = JSON.parse(body);
  } catch {
    return NO_FIELDS;
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) return NO_FIELDS;

  const fields = decoded as Record<string, unknown>;
  return {
    eventId: textField(fields, "event_id"),
    event: textField(fields, "event"),
    userId: textField(fields, "user_id"),
    deviceId: textField(fields, "device_id"),
  };
}

/** Who each stored event belongs to now, by event ID. */
async function findEventOwners(db: Db, eventIds: string[]): Promise<Map<string, string | null>> {
  if (eventIds.length === 0) return new Map();
  const rows = await db
    .select({ id: events.id, personId: events.personId })
    .from(events)
    .where(inArray(events.id, eventIds));
  return new Map(rows.map((row) => [row.id, row.personId]));
}

/** The latest deliveries, newest arrival first, each with the person it belongs to. */
export async function listRecentDeliveries(db: Db, limit = 100): Promise<DeliveryLogEntry[]> {
  const rows = await db.select().from(rawWebhookEvents).orderBy(desc(rawWebhookEvents.id)).limit(limit);
  const entries = rows.map((row) => ({
    id: row.id,
    receivedAt: row.receivedAt,
    source: row.source,
    outcome: row.outcome,
    reason: row.reason,
    ...readDeliveryBody(row.body),
  }));

  // Only stored events have an owner. A refused delivery can reuse a stored
  // event's ID, so its ID says nothing about who it belongs to.
  const storedIds = entries.flatMap((entry) =>
    entry.outcome !== "rejected" && entry.eventId ? [entry.eventId] : [],
  );
  const owners = await findEventOwners(db, storedIds);

  return entries.map((entry) => ({
    ...entry,
    personId: entry.outcome !== "rejected" && entry.eventId ? (owners.get(entry.eventId) ?? null) : null,
  }));
}

/**
 * A value that changes whenever a delivery arrives, so an open page can ask
 * cheaply whether it has anything new to show.
 */
export async function latestDeliveryMarker(db: Db): Promise<string> {
  const [row] = await db.select({ latest: max(rawWebhookEvents.id) }).from(rawWebhookEvents);
  return String(row?.latest ?? 0);
}
