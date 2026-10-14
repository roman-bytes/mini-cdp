import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { listRecentEvents } from "./activity";
import { rawWebhookEvents } from "./schema";
import { buildSimulatedPayload, sendSimulatedEvent } from "./simulate";

const NOW = new Date("2026-09-28T14:22:05Z");
const INPUT = { event: "read_story", deviceId: " d_demo ", userId: "", story: " ai-regulation-bill " };

describe("buildSimulatedPayload", () => {
  it("builds the body the mobile app would send", () => {
    const payload = buildSimulatedPayload(INPUT, NOW);

    expect(payload).toMatchObject({
      event: "read_story",
      user_id: null,
      device_id: "d_demo",
      timestamp: "2026-09-28T14:22:05.000Z",
      properties: { story: "ai-regulation-bill" },
    });
    expect(payload.event_id).toMatch(/^evt_sim_[0-9a-f]{12}$/);
  });

  it("gives every event its own ID", () => {
    expect(buildSimulatedPayload(INPUT, NOW).event_id).not.toBe(buildSimulatedPayload(INPUT, NOW).event_id);
  });

  it("sends the user ID when there is one, and no properties without a story", () => {
    const payload = buildSimulatedPayload({ ...INPUT, userId: " u_1 ", story: "" }, NOW);

    expect(payload).toMatchObject({ user_id: "u_1", properties: {} });
  });
});

describe("sendSimulatedEvent", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("stores an anonymous event, then attaches it when the device logs in", async () => {
    const anonymous = await sendSimulatedEvent(db, INPUT, NOW);
    const login = await sendSimulatedEvent(
      db,
      { ...INPUT, event: "login", userId: "u_demo" },
      new Date("2026-09-28T14:25:00Z"),
    );

    expect(anonymous).toMatchObject({ ok: true, status: "accepted", personId: null });
    expect(anonymous.ok && anonymous.eventId).toMatch(/^evt_sim_/);
    expect(login).toMatchObject({ ok: true, status: "accepted" });
    const stored = await listRecentEvents(db);
    expect(stored).toHaveLength(2);
    expect(stored.every((event) => login.ok && event.personId === login.personId)).toBe(true);
  });

  it("returns the problems for input the webhook would refuse", async () => {
    const result = await sendSimulatedEvent(db, { ...INPUT, event: "purchase", deviceId: "" }, NOW);

    expect(result.ok).toBe(false);
    expect(await listRecentEvents(db)).toHaveLength(0);
  });

  it("logs every event it sends as coming from the simulator, refused ones too", async () => {
    await sendSimulatedEvent(db, INPUT, NOW);
    await sendSimulatedEvent(db, { ...INPUT, deviceId: "" }, NOW);

    const log = await db.select().from(rawWebhookEvents);

    expect(log.map((row) => [row.source, row.outcome])).toEqual([
      ["simulator", "accepted"],
      ["simulator", "rejected"],
    ]);
    expect(log[1].reason).toMatch(/^device_id: /);
  });
});
