import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { latestDeliveryMarker, listRecentDeliveries, readDeliveryBody } from "./deliveries";
import { receiveEvent } from "./webhook";

const EVENT = {
  event_id: "evt_1",
  event: "app_open",
  user_id: null,
  device_id: "d_1",
  timestamp: "2026-09-28T12:00:00Z",
};

describe("readDeliveryBody", () => {
  it("reads the fields of a well-formed event", () => {
    expect(readDeliveryBody(JSON.stringify({ ...EVENT, user_id: "u_1" }))).toEqual({
      eventId: "evt_1",
      event: "app_open",
      userId: "u_1",
      deviceId: "d_1",
    });
  });

  it("leaves out fields that are missing, blank or not text", () => {
    expect(readDeliveryBody(JSON.stringify({ event_id: 42, event: " ", device_id: "d_1" }))).toEqual({
      eventId: null,
      event: null,
      userId: null,
      deviceId: "d_1",
    });
  });

  it.each(["{not json", "[1, 2]", "null", '"text"'])("finds nothing in the body %j", (body) => {
    expect(readDeliveryBody(body)).toEqual({ eventId: null, event: null, userId: null, deviceId: null });
  });
});

describe("listRecentDeliveries", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  function send(body: unknown, source: "webhook" | "simulator" = "webhook") {
    return receiveEvent(db, typeof body === "string" ? body : JSON.stringify(body), source);
  }

  it("lists deliveries newest first, with what happened and where they came from", async () => {
    await send(EVENT);
    await send(EVENT);
    await send("{not json", "simulator");

    const log = await listRecentDeliveries(db);

    expect(log.map((entry) => [entry.outcome, entry.source])).toEqual([
      ["rejected", "simulator"],
      ["duplicate", "webhook"],
      ["accepted", "webhook"],
    ]);
    expect(log[0].reason).toBe("body: not valid JSON");
    expect(log[2]).toMatchObject({ eventId: "evt_1", event: "app_open", deviceId: "d_1", userId: null });
  });

  it("shows who an event belongs to now, including after the device logs in", async () => {
    await send(EVENT);
    expect((await listRecentDeliveries(db))[0].personId).toBeNull();

    const login = await send({ ...EVENT, event_id: "evt_2", event: "login", user_id: "u_1", timestamp: "2026-09-28T12:05:00Z" });
    const log = await listRecentDeliveries(db);

    expect(login.ok && login.personId).toBeTruthy();
    expect(log.map((entry) => entry.personId)).toEqual([
      login.ok && login.personId,
      login.ok && login.personId,
    ]);
  });

  it("never links a refused delivery to a person, even when it reuses a stored event's ID", async () => {
    await send({ ...EVENT, user_id: "u_1" });
    await send({ ...EVENT, event: "purchase" });

    const [refused, stored] = await listRecentDeliveries(db);

    expect(refused).toMatchObject({ outcome: "rejected", eventId: "evt_1", personId: null });
    expect(stored.personId).not.toBeNull();
  });

  it("keeps to the limit", async () => {
    for (let index = 1; index <= 3; index += 1) await send({ ...EVENT, event_id: `evt_${index}` });

    const log = await listRecentDeliveries(db, 2);

    expect(log.map((entry) => entry.eventId)).toEqual(["evt_3", "evt_2"]);
  });
});

describe("latestDeliveryMarker", () => {
  it("moves on every delivery, refused ones included", async () => {
    const db = await createTestDb();
    const empty = await latestDeliveryMarker(db);

    await receiveEvent(db, JSON.stringify(EVENT), "webhook");
    const afterOne = await latestDeliveryMarker(db);
    await receiveEvent(db, "{not json", "webhook");
    const afterTwo = await latestDeliveryMarker(db);

    expect(new Set([empty, afterOne, afterTwo]).size).toBe(3);
    expect(await latestDeliveryMarker(db)).toBe(afterTwo);
  });
});
