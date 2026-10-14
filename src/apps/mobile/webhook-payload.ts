import { z } from "zod";

import { APP_EVENT_NAMES, type AppEventName } from "./schema";

/** The JSON the mobile app posts to /webhooks/app. */
const payloadSchema = z.object({
  event_id: z.string().trim().min(1).max(200),
  event: z.enum(APP_EVENT_NAMES),
  // Null (or left out) until the device logs in.
  user_id: z.string().trim().min(1).max(200).nullish(),
  device_id: z.string().trim().min(1).max(200),
  timestamp: z.iso.datetime({ offset: true }),
  properties: z.record(z.string(), z.unknown()).nullish(),
});

/** A webhook event after checking, in the shape the rest of the app uses. */
export type IncomingEvent = {
  id: string;
  event: AppEventName;
  userId: string | null;
  deviceId: string;
  occurredAt: Date;
  properties: Record<string, unknown>;
};

export type PayloadCheck =
  | { ok: true; event: IncomingEvent }
  | { ok: false; errors: string[] };

/** Checks a decoded request body. Returns the event, or what is wrong with it. */
export function parseWebhookPayload(body: unknown): PayloadCheck {
  const result = payloadSchema.safeParse(body);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "body"}: ${issue.message}`,
    );
    return { ok: false, errors };
  }

  const payload = result.data;
  return {
    ok: true,
    event: {
      id: payload.event_id,
      event: payload.event,
      userId: payload.user_id ?? null,
      deviceId: payload.device_id,
      occurredAt: new Date(payload.timestamp),
      properties: payload.properties ?? {},
    },
  };
}
