import { and, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  findOrCreatePerson,
  findPersonByAnyIdentifier,
  findPersonById,
  linkIdentifiers,
} from "@/apps/people/identifiers";
import type { IdentifierType } from "@/apps/people/schema";
import type { Db } from "@/shared/db/client";

import { events } from "./schema";
import type { IncomingEvent } from "./webhook-payload";

export type IngestResult = {
  status: "accepted" | "duplicate";
  /** The person the event belongs to, or null while it is still anonymous. */
  personId: string | null;
};

/**
 * Makes events for the same device wait for each other. Without this, a login
 * and an anonymous event arriving at the same instant could each miss the
 * other and leave the anonymous event unattached.
 */
async function lockDevice(db: Db, deviceId: string): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${deviceId}))`);
}

/**
 * What an event's user ID is looked up as when it is not a person ID, in
 * order: every kind of ID a person can have. The app's own user IDs come
 * first. An app may also send the person's email, their web visitor ID or a
 * device ID as the user ID, and any of those points at the person who
 * already has it.
 */
export const USER_ID_LOOKUP_ORDER: IdentifierType[] = ["user_id", "email", "visitor_id", "device_id"];

/**
 * Who an event's user ID belongs to. A person ID (the ID shown on a profile)
 * is that person. Otherwise the user ID is looked up as USER_ID_LOOKUP_ORDER
 * says, and saved as the person's app user ID, so the next event finds them
 * directly. A user ID nobody has gets a new person, so the event is not
 * dropped.
 */
async function findOwnerOfUserId(db: Db, userId: string): Promise<string> {
  const byPersonId = await findPersonById(db, userId);
  if (byPersonId) return byPersonId;

  const known = await findPersonByAnyIdentifier(db, USER_ID_LOOKUP_ORDER, userId);
  if (!known) return findOrCreatePerson(db, "user_id", userId, "mobile");
  await linkIdentifiers(db, [{ personId: known, type: "user_id", value: userId }], "mobile");
  return known;
}

/**
 * The person behind a logged-in event, or null for an anonymous one. The
 * device is linked to that person too, so a lookup by device ID finds them.
 */
async function resolvePerson(db: Db, event: IncomingEvent): Promise<string | null> {
  if (!event.userId) return null;
  const personId = await findOwnerOfUserId(db, event.userId);
  await linkIdentifiers(db, [{ personId, type: "device_id", value: event.deviceId }], "mobile");
  return personId;
}

/** Stores the event. Returns false when this event ID is already stored. */
async function insertEvent(db: Db, event: IncomingEvent, personId: string | null): Promise<boolean> {
  const inserted = await db
    .insert(events)
    .values({
      id: event.id,
      event: event.event,
      userId: event.userId,
      deviceId: event.deviceId,
      personId,
      occurredAt: event.occurredAt,
      properties: event.properties,
    })
    .onConflictDoNothing({ target: events.id })
    .returning({ id: events.id });
  return inserted.length === 1;
}

/**
 * Gives every anonymous event on a device the person of the next logged-in
 * event on that device, by the time the events happened. It recomputes all of
 * them from the stored events each time, so the result is the same whatever
 * order the events arrived in. Anonymous events with no later login stay
 * unattached until one arrives.
 */
export async function attachAnonymousEvents(db: Db, deviceId: string): Promise<void> {
  const later = alias(events, "later");
  const nextLoggedInPerson = sql`(
    select ${later.personId} from ${events} as "later"
    where ${later.deviceId} = ${events.deviceId}
      and ${later.userId} is not null
      and ${later.occurredAt} >= ${events.occurredAt}
    order by ${later.occurredAt}, ${later.id}
    limit 1
  )`;
  await db
    .update(events)
    .set({ personId: nextLoggedInPerson })
    .where(and(eq(events.deviceId, deviceId), isNull(events.userId)));
}

async function findEventPerson(db: Db, eventId: string): Promise<string | null> {
  const [row] = await db
    .select({ personId: events.personId })
    .from(events)
    .where(eq(events.id, eventId));
  return row?.personId ?? null;
}

/**
 * Takes in one event from the mobile app. Safe to call twice with the same
 * event (the second call changes nothing) and in any order.
 */
export async function ingestEvent(db: Db, event: IncomingEvent): Promise<IngestResult> {
  return db.transaction(async (tx) => {
    await lockDevice(tx, event.deviceId);

    const personId = await resolvePerson(tx, event);
    const isNew = await insertEvent(tx, event, personId);
    if (isNew) await attachAnonymousEvents(tx, event.deviceId);

    return {
      status: isNew ? "accepted" : "duplicate",
      personId: await findEventPerson(tx, event.id),
    };
  });
}
