import { asc, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { findOrCreatePerson, findPersonByIdentifier } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { importWebEvents, planWebEventImport } from "./import-web-events";
import { rawWebEvents, visits } from "./schema";
import type { RawWebEventRow } from "./web-event-rows";

function rawRow(overrides: Partial<RawWebEventRow> = {}): RawWebEventRow {
  return {
    visitor_id: "v_1",
    page: "/",
    timestamp: "2026-07-01 10:00:00",
    utm_source: "",
    email: "",
    ...overrides,
  };
}

/** A visitor who browses, signs up with an email, then comes back. */
const SIGNUP_JOURNEY = [
  rawRow({ page: "/news/ai-regulation-bill", timestamp: "2026-07-01 10:00:00", utm_source: "instagram" }),
  rawRow({ page: "/subscribe", timestamp: "2026-07-01 10:05:00", email: "Julia.Evans230@Gmail.com" }),
  rawRow({ page: "/about", timestamp: "2026-07-03 09:00:00" }),
];

describe("planWebEventImport", () => {
  it("loads usable rows and sets aside the rest", () => {
    const plan = planWebEventImport([rawRow(), rawRow({ timestamp: "nope" })]);

    expect(plan.visits).toHaveLength(1);
    expect(plan.rows).toEqual([
      { result: { outcome: "loaded", reason: null }, visitorId: "v_1" },
      { result: { outcome: "set_aside", reason: "Invalid timestamp" }, visitorId: null },
    ]);
  });
});

describe("importWebEvents", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("attaches every visit from a visitor, not just the one with the email", async () => {
    const subscriber = await findOrCreatePerson(db, "email", "julia.evans230@gmail.com", "newsletter");

    await importWebEvents(db, SIGNUP_JOURNEY);

    const stored = await db.select().from(visits).orderBy(asc(visits.occurredAt));
    expect(stored.map((visit) => [visit.page, visit.personId])).toEqual([
      ["/news/ai-regulation-bill", subscriber],
      ["/subscribe", subscriber],
      ["/about", subscriber],
    ]);
  });

  it("links the visitor ID to the person", async () => {
    const subscriber = await findOrCreatePerson(db, "email", "julia.evans230@gmail.com", "newsletter");

    await importWebEvents(db, SIGNUP_JOURNEY);

    expect(await findPersonByIdentifier(db, "visitor_id", "v_1")).toBe(subscriber);
  });

  it("keeps visits from a visitor with no email, unattached", async () => {
    await importWebEvents(db, [rawRow({ visitor_id: "v_anon" }), rawRow({ visitor_id: "v_anon", page: "/subscribe" })]);

    const anonymous = await db.select().from(visits).where(isNull(visits.personId));

    expect(anonymous).toHaveLength(2);
    expect(await findPersonByIdentifier(db, "visitor_id", "v_anon")).toBeNull();
  });

  it("creates a person for an email nobody has seen before", async () => {
    await importWebEvents(db, SIGNUP_JOURNEY);

    const personId = await findPersonByIdentifier(db, "email", "julia.evans230@gmail.com");
    const stored = await db.select().from(visits);

    expect(personId).not.toBeNull();
    expect(stored.every((visit) => visit.personId === personId)).toBe(true);
  });

  it("stores the visit time as UTC and the channel in its stored form", async () => {
    await importWebEvents(db, [rawRow({ timestamp: "2026-06-30 20:11:42", utm_source: "twitter" })]);

    const [stored] = await db.select().from(visits);

    expect(stored.occurredAt.toISOString()).toBe("2026-06-30T20:11:42.000Z");
    expect(stored.utmSource).toBe("x");
  });

  it("keeps every source row in the raw layer, with the person it resolved to", async () => {
    const subscriber = await findOrCreatePerson(db, "email", "julia.evans230@gmail.com", "newsletter");

    await importWebEvents(db, [...SIGNUP_JOURNEY, rawRow({ visitor_id: "", page: "/x" })]);

    const raw = await db.select().from(rawWebEvents).orderBy(asc(rawWebEvents.rowNumber));
    expect(raw.map((row) => [row.rowNumber, row.outcome, row.personId])).toEqual([
      [2, "loaded", subscriber],
      [3, "loaded", subscriber],
      [4, "loaded", subscriber],
      [5, "set_aside", null],
    ]);
    expect(raw[1].email).toBe("Julia.Evans230@Gmail.com");
    expect(raw[3].reason).toBe("Missing visitor ID");
  });

  it("is safe to run twice: visits are replaced, not doubled", async () => {
    await importWebEvents(db, SIGNUP_JOURNEY);
    await importWebEvents(db, SIGNUP_JOURNEY);

    expect(await db.select().from(visits)).toHaveLength(3);
    expect(await db.select().from(rawWebEvents)).toHaveLength(3);
  });
});
