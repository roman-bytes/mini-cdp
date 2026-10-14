import { randomBytes } from "node:crypto";

import type { Db } from "@/shared/db/client";

import { receiveEvent, type ReceiveResult } from "./webhook";

/** What the Event simulator form collects. */
export type SimulatedEventInput = {
  event: string;
  deviceId: string;
  /** Empty means the device has not logged in. */
  userId: string;
  /** Optional story slug, sent as properties.story. */
  story: string;
};

export type SimulationResult = ReceiveResult;

/** The JSON body the mobile app would send for this input. */
export function buildSimulatedPayload(input: SimulatedEventInput, now: Date): Record<string, unknown> {
  const story = input.story.trim();
  return {
    event_id: `evt_sim_${randomBytes(6).toString("hex")}`,
    event: input.event,
    user_id: input.userId.trim() || null,
    device_id: input.deviceId.trim(),
    timestamp: now.toISOString(),
    properties: story ? { story } : {},
  };
}

/**
 * Sends a made-up event through the same checks and the same ingest function
 * as a real webhook delivery, and logs it as coming from the simulator. Only
 * the API key check is skipped, because the person using the simulator is
 * already signed in to the app.
 */
export async function sendSimulatedEvent(
  db: Db,
  input: SimulatedEventInput,
  now: Date = new Date(),
): Promise<SimulationResult> {
  return receiveEvent(db, JSON.stringify(buildSimulatedPayload(input, now)), "simulator");
}
