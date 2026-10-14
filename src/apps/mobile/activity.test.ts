import { describe, expect, it } from "vitest";

import { findOrCreatePerson } from "@/apps/people/identifiers";
import { createTestDb } from "@/shared/db/testing";

import { personActivityMarker } from "./activity";
import { receiveEvent } from "./webhook";

function body(fields: Record<string, unknown>): string {
  return JSON.stringify({ device_id: "d_1", timestamp: "2026-09-28T12:00:00Z", user_id: null, ...fields });
}

describe("personActivityMarker", () => {
  it("moves when the person gets a new event, and not otherwise", async () => {
    const db = await createTestDb();
    const personId = await findOrCreatePerson(db, "user_id", "u_1", "mobile");
    const before = await personActivityMarker(db, personId);

    await receiveEvent(db, body({ event_id: "evt_1", event: "app_open", user_id: "u_1" }), "webhook");
    const after = await personActivityMarker(db, personId);
    await receiveEvent(db, body({ event_id: "evt_1", event: "app_open", user_id: "u_1" }), "webhook");
    await receiveEvent(db, body({ event_id: "evt_x", event: "app_open", user_id: "u_2", device_id: "d_2" }), "webhook");

    expect(after).not.toBe(before);
    expect(await personActivityMarker(db, personId)).toBe(after);
  });

  it("moves when an anonymous event is attached to the person at login", async () => {
    const db = await createTestDb();
    const personId = await findOrCreatePerson(db, "user_id", "u_1", "mobile");

    // The login arrives first; the earlier anonymous event arrives after it.
    await receiveEvent(
      db,
      body({ event_id: "evt_login", event: "login", user_id: "u_1", timestamp: "2026-09-28T12:05:00Z" }),
      "webhook",
    );
    const afterLogin = await personActivityMarker(db, personId);
    await receiveEvent(db, body({ event_id: "evt_anon", event: "app_open" }), "webhook");

    expect(await personActivityMarker(db, personId)).not.toBe(afterLogin);
  });
});
