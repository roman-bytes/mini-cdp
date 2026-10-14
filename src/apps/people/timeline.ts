import type { AppEvent } from "@/apps/mobile/activity";
import type { Visit } from "@/apps/web/visits";

/** Where a timeline entry came from. */
export const TIMELINE_SOURCES = ["web", "app"] as const;
export type TimelineSource = (typeof TIMELINE_SOURCES)[number];

/** One thing a person did, in a shape both sources share. */
export type TimelineEntry = {
  key: string;
  source: TimelineSource;
  at: Date;
  /** What happened, e.g. "Visited" or "read_story". */
  action: string;
  /** What it happened to: a page path, a story, or nothing. */
  subject: string | null;
  /** Extra context, e.g. the channel the visit came from or the device. */
  detail: string | null;
  /** When it reached us live. Null for visits, which come from the import. */
  arrivedAt: Date | null;
};

function visitEntry(visit: Visit): TimelineEntry {
  return {
    key: `web-${visit.id}`,
    source: "web",
    at: visit.occurredAt,
    action: "Visited",
    subject: visit.page,
    detail: visit.utmSource ? `via ${visit.utmSource}` : null,
    arrivedAt: null,
  };
}

/** The most useful single value in an event's properties, if there is one. */
export function describeProperties(properties: Record<string, unknown>): string | null {
  const first = Object.entries(properties)[0];
  if (!first) return null;
  const [name, value] = first;
  return typeof value === "string" ? value : `${name}: ${JSON.stringify(value)}`;
}

function eventEntry(event: AppEvent): TimelineEntry {
  return {
    key: `app-${event.id}`,
    source: "app",
    at: event.occurredAt,
    action: event.event,
    subject: describeProperties(event.properties),
    detail: `device ${event.deviceId}`,
    arrivedAt: event.receivedAt,
  };
}

/**
 * Merges a person's web visits and app events into one list, newest first by
 * the time each thing happened (not the time it arrived).
 */
export function buildTimeline(visits: Visit[], events: AppEvent[]): TimelineEntry[] {
  const entries = [...visits.map(visitEntry), ...events.map(eventEntry)];
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Keeps only one source's entries; "all" (or anything else) keeps everything. */
export function filterTimeline(entries: TimelineEntry[], source: string | undefined): TimelineEntry[] {
  const wanted = TIMELINE_SOURCES.find((candidate) => candidate === source);
  return wanted ? entries.filter((entry) => entry.source === wanted) : entries;
}
