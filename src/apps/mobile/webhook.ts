import { readBearerToken, verifyApiKey } from "@/shared/auth/api-keys";
import { consumeRateLimit, type RateLimit } from "@/shared/auth/rate-limit";
import type { Db } from "@/shared/db/client";

import { ingestEvent, type IngestResult } from "./ingest-event";
import { rawWebhookEvents, type DeliveryOutcome, type DeliverySource } from "./schema";
import { parseWebhookPayload, type PayloadCheck } from "./webhook-payload";

/** The largest request body the webhook reads. A real event is far smaller. */
export const MAX_BODY_BYTES = 64 * 1024;

/** How many events one API key may send per minute. */
export const WEBHOOK_RATE_LIMIT: RateLimit = { limit: 600, windowSeconds: 60 };

/** What the webhook needs from the HTTP request. */
export type WebhookDelivery = {
  authorization: string | null;
  body: string;
};

/** What the webhook answers: an HTTP status and a JSON body. */
export type WebhookReply = {
  status: number;
  body: Record<string, unknown>;
};

/** What became of one event body: stored (or already stored), or refused and why. */
export type ReceiveResult =
  | ({ ok: true; eventId: string } & IngestResult)
  | { ok: false; errors: string[] };

function reply(status: number, body: Record<string, unknown>): WebhookReply {
  return { status, body };
}

/** Decodes JSON without throwing. */
function decodeJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

/** Checks a body as it arrived: it must be JSON, and an event the app understands. */
function checkEventBody(body: string): PayloadCheck {
  const decoded = decodeJson(body);
  if (!decoded.ok) return { ok: false, errors: ["body: not valid JSON"] };
  return parseWebhookPayload(decoded.value);
}

type DeliveryRecord = {
  source: DeliverySource;
  outcome: DeliveryOutcome;
  reason: string | null;
  body: string;
};

/** Keeps a copy of the delivery and what was done with it. */
async function recordDelivery(db: Db, record: DeliveryRecord): Promise<void> {
  await db.insert(rawWebhookEvents).values({ ...record, body: record.body.slice(0, MAX_BODY_BYTES) });
}

/**
 * Takes in one event body, whichever way it arrived: checks it, stores the
 * event, and keeps a copy of the body in the delivery log with what was done
 * with it. The webhook and the event simulator both come through here.
 */
export async function receiveEvent(db: Db, body: string, source: DeliverySource): Promise<ReceiveResult> {
  const check = checkEventBody(body);
  if (!check.ok) {
    await recordDelivery(db, { source, outcome: "rejected", reason: check.errors.join("; "), body });
    return check;
  }

  const result = await ingestEvent(db, check.event);
  await recordDelivery(db, { source, outcome: result.status, reason: null, body });
  return { ok: true, eventId: check.event.id, ...result };
}

/**
 * Handles one POST to /webhooks/app from start to finish:
 * check the API key, check the rate limit, check the body, store the event.
 */
export async function handleWebhookDelivery(
  db: Db,
  delivery: WebhookDelivery,
  now: Date = new Date(),
): Promise<WebhookReply> {
  const keyId = await verifyApiKey(db, readBearerToken(delivery.authorization), now);
  if (!keyId) return reply(401, { error: "Missing or invalid API key" });

  const withinLimit = await consumeRateLimit(db, keyId, WEBHOOK_RATE_LIMIT, now);
  if (!withinLimit) return reply(429, { error: "Too many requests" });

  if (Buffer.byteLength(delivery.body) > MAX_BODY_BYTES) {
    return reply(413, { error: "Request body is too large" });
  }

  const result = await receiveEvent(db, delivery.body, "webhook");
  if (!result.ok) return reply(400, { error: "Invalid event", details: result.errors });
  return reply(200, { status: result.status, event_id: result.eventId, person_id: result.personId });
}
