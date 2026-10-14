import { describe, expect, it } from "vitest";

import type { AppEvent } from "@/apps/mobile/activity";
import type { Visit } from "@/apps/web/visits";

import { buildTimeline, describeProperties, filterTimeline } from "./timeline";

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: 1,
    visitorId: "v_1",
    personId: "p",
    page: "/about",
    occurredAt: new Date("2026-09-01T10:00:00Z"),
    utmSource: null,
    ...overrides,
  };
}

function appEvent(overrides: Partial<AppEvent> = {}): AppEvent {
  return {
    id: "evt_1",
    event: "read_story",
    userId: "u_1",
    deviceId: "d_1",
    personId: "p",
    occurredAt: new Date("2026-09-02T10:00:00Z"),
    receivedAt: new Date("2026-09-03T00:00:00Z"),
    properties: { story: "supreme-court-ruling-explained" },
    ...overrides,
  };
}

describe("describeProperties", () => {
  it("shows a text value on its own", () => {
    expect(describeProperties({ story: "ai-regulation-bill" })).toBe("ai-regulation-bill");
  });

  it("names a value that is not text", () => {
    expect(describeProperties({ position: 3 })).toBe("position: 3");
  });

  it("returns null when there are no properties", () => {
    expect(describeProperties({})).toBeNull();
  });
});

describe("buildTimeline", () => {
  it("merges both sources, newest first by when things happened", () => {
    const timeline = buildTimeline(
      [visit({ id: 1, occurredAt: new Date("2026-09-01T10:00:00Z") }), visit({ id: 2, occurredAt: new Date("2026-09-05T10:00:00Z") })],
      [appEvent({ occurredAt: new Date("2026-09-03T10:00:00Z") })],
    );

    expect(timeline.map((entry) => entry.key)).toEqual(["web-2", "app-evt_1", "web-1"]);
  });

  it("orders by event time, not by when the event arrived", () => {
    const timeline = buildTimeline(
      [],
      [
        appEvent({ id: "late-arrival", occurredAt: new Date("2026-09-01T00:00:00Z"), receivedAt: new Date("2026-09-09T00:00:00Z") }),
        appEvent({ id: "on-time", occurredAt: new Date("2026-09-02T00:00:00Z"), receivedAt: new Date("2026-09-02T00:00:01Z") }),
      ],
    );

    expect(timeline.map((entry) => entry.key)).toEqual(["app-on-time", "app-late-arrival"]);
  });

  it("describes a visit and an app event", () => {
    const [event, visited] = buildTimeline([visit({ utmSource: "instagram" })], [appEvent()]);

    expect(visited).toMatchObject({ source: "web", action: "Visited", subject: "/about", detail: "via instagram" });
    expect(event).toMatchObject({
      source: "app",
      action: "read_story",
      subject: "supreme-court-ruling-explained",
      detail: "device d_1",
    });
  });
});

describe("filterTimeline", () => {
  const timeline = buildTimeline([visit()], [appEvent()]);

  it("keeps one source when asked", () => {
    expect(filterTimeline(timeline, "web").map((entry) => entry.source)).toEqual(["web"]);
    expect(filterTimeline(timeline, "app").map((entry) => entry.source)).toEqual(["app"]);
  });

  it("keeps everything for any other value", () => {
    expect(filterTimeline(timeline, undefined)).toHaveLength(2);
    expect(filterTimeline(timeline, "nonsense")).toHaveLength(2);
  });
});
