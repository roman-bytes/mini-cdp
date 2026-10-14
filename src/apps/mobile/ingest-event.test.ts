import { asc, count, eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { importAppUsers } from "@/apps/mobile/import-app-users";
import { importSubscribers } from "@/apps/newsletter/import-subscribers";
import { findOrCreatePerson, findPersonByIdentifier, linkIdentifiers } from "@/apps/people/identifiers";
import { IDENTIFIER_TYPES, identifiers, people } from "@/apps/people/schema";
import { getProfile } from "@/apps/people/directory";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { listEventsForPerson, listRecentEvents } from "./activity";
import { ingestEvent, USER_ID_LOOKUP_ORDER } from "./ingest-event";
import { events } from "./schema";
import type { IncomingEvent } from "./webhook-payload";

/** Builds an event. `minute` places it on a timeline, so order is easy to read. */
function event(id: string, minute: number, overrides: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    id,
    event: "app_open",
    userId: null,
    deviceId: "d_1",
    occurredAt: new Date(Date.UTC(2026, 8, 28, 14, minute)),
    properties: {},
    ...overrides,
  };
}

/** Every stored event as "id -> person", for comparing end states. */
async function snapshot(db: Db): Promise<Record<string, string | null>> {
  const rows = await db.select({ id: events.id, personId: events.personId }).from(events).orderBy(asc(events.id));
  return Object.fromEntries(rows.map((row) => [row.id, row.personId]));
}

/** A fresh database with one subscriber who has the app account u_known. */
async function createDbWithKnownUser(): Promise<Db> {
  const db = await createTestDb();
  await importSubscribers(db, [
    { email: "known@example.com", signup_date: "2026-07-04", status: "active", acquisition_source: "Instagram", last_open_date: "" },
  ]);
  await importAppUsers(db, [{ user_id: "u_known", email: "known@example.com", created_at: "2026-08-22" }]);
  return db;
}

/** A small deterministic shuffle, so a failing order can be reproduced. */
function shuffled<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swap = state % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

describe("ingestEvent", () => {
  let db: Db;
  let knownPerson: string;

  beforeEach(async () => {
    db = await createDbWithKnownUser();
    knownPerson = (await findPersonByIdentifier(db, "user_id", "u_known"))!;
  });

  it("attaches a logged-in event to the subscriber behind the user ID", async () => {
    const result = await ingestEvent(db, event("e1", 1, { userId: "u_known" }));

    expect(result).toEqual({ status: "accepted", personId: knownPerson });
  });

  it("keeps an anonymous event, unattached, until the device logs in", async () => {
    const result = await ingestEvent(db, event("e1", 1));

    expect(result).toEqual({ status: "accepted", personId: null });
    expect(await listRecentEvents(db)).toHaveLength(1);
  });

  it("attaches earlier anonymous events when the device logs in", async () => {
    await ingestEvent(db, event("e1", 1));
    await ingestEvent(db, event("e2", 2, { event: "read_story" }));
    await ingestEvent(db, event("e3", 3, { event: "login", userId: "u_known" }));

    expect(await snapshot(db)).toEqual({ e1: knownPerson, e2: knownPerson, e3: knownPerson });
  });

  it("attaches an anonymous event that arrives after its login was processed", async () => {
    await ingestEvent(db, event("e3", 3, { event: "login", userId: "u_known" }));
    const late = await ingestEvent(db, event("e1", 1));

    expect(late.personId).toBe(knownPerson);
  });

  it("stores an event once when it is delivered twice", async () => {
    const first = await ingestEvent(db, event("e1", 1, { userId: "u_known" }));
    const second = await ingestEvent(db, event("e1", 1, { userId: "u_known" }));

    expect(first.status).toBe("accepted");
    expect(second).toEqual({ status: "duplicate", personId: knownPerson });
    expect(await listRecentEvents(db)).toHaveLength(1);
  });

  it("gives a user ID it has never seen a profile, instead of dropping the event", async () => {
    const result = await ingestEvent(db, event("e1", 1, { userId: "u_never_seen" }));
    const profile = await getProfile(db, result.personId!);

    expect(profile).toMatchObject({ kind: "unknown", email: null, appEventCount: 1 });
    expect(await findPersonByIdentifier(db, "user_id", "u_never_seen")).toBe(result.personId);
  });

  async function countPeople(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(people);
    return row.total;
  }

  it("attaches a user ID that is someone's email to that person, whatever its case", async () => {
    const before = await countPeople();
    const result = await ingestEvent(db, event("e1", 1, { userId: "Known@Example.com" }));

    expect(result.personId).toBe(knownPerson);
    expect(await countPeople()).toBe(before);
    expect(await findPersonByIdentifier(db, "user_id", "Known@Example.com")).toBe(knownPerson);
  });

  it("attaches a user ID that is someone's web visitor ID to that person, with the device's earlier events", async () => {
    await linkIdentifiers(db, [{ personId: knownPerson, type: "visitor_id", value: "v_known" }], "web");
    const before = await countPeople();

    await ingestEvent(db, event("e1", 1));
    await ingestEvent(db, event("e2", 2, { event: "login", userId: "v_known" }));

    expect(await snapshot(db)).toEqual({ e1: knownPerson, e2: knownPerson });
    expect(await countPeople()).toBe(before);
    expect(await findPersonByIdentifier(db, "user_id", "v_known")).toBe(knownPerson);
  });

  it("attaches a user ID that is a person ID to that person, without saving it as an app user ID", async () => {
    const before = await countPeople();

    const result = await ingestEvent(db, event("e1", 1, { userId: knownPerson.toUpperCase() }));

    expect(result.personId).toBe(knownPerson);
    expect(await countPeople()).toBe(before);
    expect(await findPersonByIdentifier(db, "user_id", knownPerson.toUpperCase())).toBeNull();
  });

  it("goes by the person ID even when another person has it as an app user ID", async () => {
    const other = await findOrCreatePerson(db, "user_id", knownPerson, "mobile");

    const result = await ingestEvent(db, event("e1", 1, { userId: knownPerson }));

    expect(result.personId).toBe(knownPerson);
    expect(result.personId).not.toBe(other);
  });

  it("attaches a user ID that is a device ID linked to someone to that person", async () => {
    await linkIdentifiers(db, [{ personId: knownPerson, type: "device_id", value: "d_phone" }], "mobile");

    const result = await ingestEvent(db, event("e1", 1, { deviceId: "d_other", userId: "d_phone" }));

    expect(result.personId).toBe(knownPerson);
  });

  it("looks the user ID up as every kind of ID a person can have", () => {
    expect([...USER_ID_LOOKUP_ORDER].sort()).toEqual([...IDENTIFIER_TYPES].sort());
  });

  it("prefers the app's own user ID when another person has the same value as a visitor ID", async () => {
    const visitor = await findOrCreatePerson(db, "visitor_id", "u_known", "web");

    const result = await ingestEvent(db, event("e1", 1, { userId: "u_known" }));

    expect(result.personId).toBe(knownPerson);
    expect(result.personId).not.toBe(visitor);
  });

  it("keeps devices apart", async () => {
    await ingestEvent(db, event("a1", 1, { deviceId: "d_a" }));
    await ingestEvent(db, event("b1", 2, { deviceId: "d_b", event: "login", userId: "u_known" }));

    expect(await snapshot(db)).toEqual({ a1: null, b1: knownPerson });
  });

  it("gives anonymous events to the next user who logs in on a shared device", async () => {
    await ingestEvent(db, event("e1", 1));
    await ingestEvent(db, event("e2", 2, { event: "login", userId: "u_known" }));
    await ingestEvent(db, event("e3", 3));
    const other = await ingestEvent(db, event("e4", 4, { event: "login", userId: "u_other" }));

    expect(await snapshot(db)).toEqual({
      e1: knownPerson,
      e2: knownPerson,
      e3: other.personId,
      e4: other.personId,
    });
  });

  it("makes the device findable in People once it has logged in", async () => {
    await ingestEvent(db, event("e1", 1, { event: "login", userId: "u_known" }));

    expect(await findPersonByIdentifier(db, "device_id", "d_1")).toBe(knownPerson);
  });

  it("lists a person's events newest first by event time, not arrival order", async () => {
    await ingestEvent(db, event("newest", 9, { userId: "u_known" }));
    await ingestEvent(db, event("oldest", 1, { userId: "u_known" }));
    await ingestEvent(db, event("middle", 5, { userId: "u_known" }));

    const listed = await listEventsForPerson(db, knownPerson);
    expect(listed.map((row) => row.id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("shows up in the person's profile straight away", async () => {
    await ingestEvent(db, event("e1", 1, { userId: "u_known" }));

    expect(await getProfile(db, knownPerson)).toMatchObject({ appEventCount: 1 });
  });
});

/**
 * The proof for "events can arrive out of order and can arrive twice":
 * one history, replayed in 100 shuffled orders with duplicates, must always
 * leave the database in exactly the same state.
 */
describe("ingestEvent replayed in any order", () => {
  const HISTORY: IncomingEvent[] = [
    event("a1", 1, { deviceId: "d_a" }),
    event("a2", 2, { deviceId: "d_a", event: "read_story" }),
    event("a3", 3, { deviceId: "d_a", event: "login", userId: "u_known" }),
    event("a4", 4, { deviceId: "d_a", event: "read_story", userId: "u_known" }),
    event("b1", 1, { deviceId: "d_b" }),
    event("b2", 5, { deviceId: "d_b", event: "login", userId: "u_stranger" }),
    event("b3", 6, { deviceId: "d_b", event: "link_click", userId: "u_stranger" }),
    event("c1", 2, { deviceId: "d_c" }),
    event("c2", 7, { deviceId: "d_c", event: "app_open" }),
    event("s1", 1, { deviceId: "d_shared" }),
    event("s2", 2, { deviceId: "d_shared", event: "login", userId: "u_known" }),
    event("s3", 3, { deviceId: "d_shared" }),
    event("s4", 4, { deviceId: "d_shared", event: "login", userId: "u_stranger" }),
  ];

  let db: Db;

  beforeAll(async () => {
    db = await createDbWithKnownUser();
  });

  /** Puts the database back to "one known user, no events" between replays. */
  async function forgetEvents(): Promise<void> {
    await db.delete(events);
    await db.delete(identifiers).where(eq(identifiers.type, "device_id"));
    await db.delete(identifiers).where(eq(identifiers.value, "u_stranger"));
    await db.execute(
      sql`delete from ${people} where ${people.id} not in (select ${identifiers.personId} from ${identifiers})`,
    );
  }

  /** Replays the history in one order and describes who ended up with what. */
  async function replay(order: IncomingEvent[]): Promise<Record<string, string>> {
    await forgetEvents();
    for (const item of order) await ingestEvent(db, item);

    const known = await findPersonByIdentifier(db, "user_id", "u_known");
    const stranger = await findPersonByIdentifier(db, "user_id", "u_stranger");
    const nameOf = (personId: string | null) =>
      personId === null ? "nobody" : personId === known ? "known" : personId === stranger ? "stranger" : "someone else";

    const state = await snapshot(db);
    return Object.fromEntries(Object.entries(state).map(([id, personId]) => [id, nameOf(personId)]));
  }

  it("ends in the same state for 100 shuffled, duplicated replays", async () => {
    const expected = {
      a1: "known", a2: "known", a3: "known", a4: "known",
      b1: "stranger", b2: "stranger", b3: "stranger",
      c1: "nobody", c2: "nobody",
      s1: "known", s2: "known", s3: "stranger", s4: "stranger",
    };
    expect(await replay(HISTORY)).toEqual(expected);

    for (let seed = 1; seed <= 100; seed += 1) {
      const withDuplicates = [...HISTORY, ...shuffled(HISTORY, seed + 1000).slice(0, 5)];
      const state = await replay(shuffled(withDuplicates, seed));
      expect(state, `replay with seed ${seed}`).toEqual(expected);
    }
  }, 300_000);
});
