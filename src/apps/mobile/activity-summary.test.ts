import { describe, expect, it } from "vitest";

import type { AppEvent } from "./activity";
import { summariseEvents } from "./activity-summary";

function appEvent(overrides: Partial<AppEvent>): AppEvent {
  return {
    id: "e",
    event: "app_open",
    userId: null,
    deviceId: "d_1",
    personId: null,
    occurredAt: new Date("2026-09-28T14:00:00Z"),
    receivedAt: new Date("2026-09-28T14:00:01Z"),
    properties: {},
    ...overrides,
  };
}

describe("summariseEvents", () => {
  it("counts events by kind, with zero for kinds that never happened", () => {
    const summary = summariseEvents([
      appEvent({ event: "read_story" }),
      appEvent({ event: "read_story" }),
      appEvent({ event: "login" }),
    ]);

    expect(summary.counts).toEqual({ app_open: 0, read_story: 2, link_click: 0, login: 1 });
  });

  it("lists each device once", () => {
    const summary = summariseEvents([
      appEvent({ deviceId: "d_1" }),
      appEvent({ deviceId: "d_2" }),
      appEvent({ deviceId: "d_1" }),
    ]);

    expect(summary.devices).toEqual(["d_1", "d_2"]);
  });

  it("handles no events", () => {
    expect(summariseEvents([])).toEqual({
      counts: { app_open: 0, read_story: 0, link_click: 0, login: 0 },
      devices: [],
    });
  });
});
