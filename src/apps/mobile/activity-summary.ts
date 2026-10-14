import { unique } from "@/shared/collections";

import type { AppEvent } from "./activity";
import { APP_EVENT_NAMES, type AppEventName } from "./schema";

export type ActivitySummary = {
  /** How many times each kind of event happened. */
  counts: Record<AppEventName, number>;
  /** The devices the events came from. */
  devices: string[];
};

/** Counts a person's app events by kind and lists the devices they used. */
export function summariseEvents(events: AppEvent[]): ActivitySummary {
  const counts = Object.fromEntries(APP_EVENT_NAMES.map((name) => [name, 0])) as Record<AppEventName, number>;
  for (const event of events) counts[event.event] += 1;
  return { counts, devices: unique(events.map((event) => event.deviceId)) };
}
