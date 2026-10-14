import { describe, expect, it } from "vitest";

import { parseWebhookPayload } from "./webhook-payload";

/** The example from the assessment brief. */
const SAMPLE = {
  event_id: "evt_9f3a1c",
  event: "read_story",
  user_id: "u_2b6447a3",
  device_id: "d_4b21e8",
  timestamp: "2026-09-28T14:22:05Z",
  properties: { story: "supreme-court-ruling-explained" },
};

/** A copy of the payload with one key left out. */
function without(payload: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([name]) => name !== key));
}

describe("parseWebhookPayload", () => {
  it("accepts the brief's sample event", () => {
    expect(parseWebhookPayload(SAMPLE)).toEqual({
      ok: true,
      event: {
        id: "evt_9f3a1c",
        event: "read_story",
        userId: "u_2b6447a3",
        deviceId: "d_4b21e8",
        occurredAt: new Date("2026-09-28T14:22:05Z"),
        properties: { story: "supreme-court-ruling-explained" },
      },
    });
  });

  it("accepts an anonymous event, with user_id null or left out", () => {
    const withoutUserId = without(SAMPLE, "user_id");

    expect(parseWebhookPayload({ ...SAMPLE, user_id: null })).toMatchObject({ ok: true, event: { userId: null } });
    expect(parseWebhookPayload(withoutUserId)).toMatchObject({ ok: true, event: { userId: null } });
  });

  it("treats missing properties as none", () => {
    const withoutProperties = without(SAMPLE, "properties");

    expect(parseWebhookPayload(withoutProperties)).toMatchObject({ ok: true, event: { properties: {} } });
  });

  it.each(["app_open", "read_story", "link_click", "login"])("accepts the event name %s", (event) => {
    expect(parseWebhookPayload({ ...SAMPLE, event }).ok).toBe(true);
  });

  it("accepts a timestamp with a timezone offset", () => {
    const check = parseWebhookPayload({ ...SAMPLE, timestamp: "2026-09-28T09:22:05-05:00" });

    expect(check).toMatchObject({ ok: true, event: { occurredAt: new Date("2026-09-28T14:22:05Z") } });
  });

  it("names the field that is wrong", () => {
    const check = parseWebhookPayload({ ...SAMPLE, event: "purchase", timestamp: "yesterday" });

    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.errors).toHaveLength(2);
      expect(check.errors[0]).toMatch(/^event: /);
      expect(check.errors[1]).toMatch(/^timestamp: /);
    }
  });

  it.each([
    ["no event_id", { ...SAMPLE, event_id: "" }],
    ["no device_id", { ...SAMPLE, device_id: undefined }],
    ["an empty user_id", { ...SAMPLE, user_id: "" }],
    ["properties that are not an object", { ...SAMPLE, properties: "story" }],
    ["a body that is not an object", "hello"],
    ["null", null],
  ])("refuses %s", (_label, body) => {
    expect(parseWebhookPayload(body).ok).toBe(false);
  });
});
