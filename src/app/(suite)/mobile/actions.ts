"use server";

import { refresh } from "next/cache";

import {
  sendSimulatedEvent,
  type SimulatedEventInput,
  type SimulationResult,
} from "@/apps/mobile/simulate";
import { getDb } from "@/shared/db/client";

/** Sends one made-up app event, then refreshes the list of events on screen. */
export async function sendSimulatedEventAction(input: SimulatedEventInput): Promise<SimulationResult> {
  const result = await sendSimulatedEvent(getDb(), input);
  refresh();
  return result;
}
