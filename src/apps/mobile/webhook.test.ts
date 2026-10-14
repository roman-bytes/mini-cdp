import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createApiKey, revokeApiKey } from "@/shared/auth/api-keys";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { listRecentEvents } from "./activity";
import { events, rawWebhookEvents } from "./schema";
import { handleWebhookDelivery, MAX_BODY_BYTES, WEBHOOK_RATE_LIMIT } from "./webhook";

/** The example from the assessment brief. */
const SAMPLE = {
  event_id: "evt_9f3a1c",
  event: "read_story",
  user_id: "u_2b6447a3",
  device_id: "d_4b21e8",
  timestamp: "2026-09-28T14:22:05Z",
  properties: { story: "supreme-court-ruling-explained" },
};

describe("handleWebhookDelivery", () => {
  let db: Db;
  let authorization: string;
  let keyId: string;

  beforeEach(async () => {
    db = await createTestDb();
    const key = await createApiKey(db, "Mobile app");
    authorization = `Bearer ${key.key}`;
    keyId = key.id;
  });

  function send(body: unknown, header: string | null = authorization) {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return handleWebhookDelivery(db, { authorization: header, body: text });
  }

  it("stores the brief's sample event and says who it belongs to", async () => {
    const reply = await send(SAMPLE);
    const [stored] = await db.select().from(events);

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ status: "accepted", event_id: "evt_9f3a1c", person_id: stored.personId });
    expect(stored).toMatchObject({
      id: "evt_9f3a1c",
      event: "read_story",
      userId: "u_2b6447a3",
      deviceId: "d_4b21e8",
      properties: { story: "supreme-court-ruling-explained" },
    });
    expect(stored.occurredAt.toISOString()).toBe("2026-09-28T14:22:05.000Z");
  });

  it("answers 200 to a repeat delivery and stores nothing new", async () => {
    await send(SAMPLE);
    const reply = await send(SAMPLE);

    expect(reply.status).toBe(200);
    expect(reply.body.status).toBe("duplicate");
    expect(await listRecentEvents(db)).toHaveLength(1);
  });

  it.each([null, "", "Bearer cdp_wrong_key", "Basic abc"])("refuses the authorization header %j", async (header) => {
    const reply = await send(SAMPLE, header);

    expect(reply.status).toBe(401);
    expect(await listRecentEvents(db)).toHaveLength(0);
  });

  it("refuses a key that has been revoked", async () => {
    await revokeApiKey(db, keyId);

    expect((await send(SAMPLE)).status).toBe(401);
  });

  it("refuses a body that is not JSON", async () => {
    const reply = await send("{not json");

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual({ error: "Invalid event", details: ["body: not valid JSON"] });
  });

  it("refuses an event with a bad shape and says which fields are wrong", async () => {
    const reply = await send({ ...SAMPLE, event: "purchase" });

    expect(reply.status).toBe(400);
    expect(reply.body.error).toBe("Invalid event");
    expect((reply.body.details as string[])[0]).toMatch(/^event: /);
    expect(await listRecentEvents(db)).toHaveLength(0);
  });

  it("refuses a body over the size limit", async () => {
    const reply = await send({ ...SAMPLE, properties: { padding: "x".repeat(MAX_BODY_BYTES) } });

    expect(reply.status).toBe(413);
  });

  it("refuses requests beyond the per-key rate limit", async () => {
    const now = new Date("2026-09-28T14:00:00Z");
    let last = 200;
    for (let request = 0; request <= WEBHOOK_RATE_LIMIT.limit; request += 1) {
      last = (await handleWebhookDelivery(db, { authorization, body: "{}" }, now)).status;
    }

    expect(last).toBe(429);
  });

  it("keeps a record of every delivery from a valid key, as it arrived", async () => {
    await send(SAMPLE);
    await send(SAMPLE);
    await send({ ...SAMPLE, event: "purchase" });

    const log = await db.select().from(rawWebhookEvents).orderBy(asc(rawWebhookEvents.id));

    expect(log.map((row) => row.outcome)).toEqual(["accepted", "duplicate", "rejected"]);
    expect(JSON.parse(log[0].body)).toEqual(SAMPLE);
    expect(log[2].reason).toMatch(/^event: /);
  });
});
