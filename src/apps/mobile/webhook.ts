import { readBearerToken, verifyApiKey } from "@/shared/auth/api-keys";
import { consumeRateLimit, type RateLimit } from "@/shared/auth/rate-limit";
import type { Db } from "@/shared/db/client";

import { ingestEvent } from "./ingest-event";
import { rawWebhookEvents, type DeliveryOutcome } from "./schema";
import { parseWebhookPayload } from "./webhook-payload";

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

/** Keeps a copy of the delivery and what was done with it. */
async function recordDelivery(
  db: Db,
  outcome: DeliveryOutcome,
  reason: string | null,
  body: string,
): Promise<void> {
  await db
    .insert(rawWebhookEvents)
    .values({ outcome, reason, body: body.slice(0, MAX_BODY_BYTES) });
}

async function rejectDelivery(db: Db, delivery: WebhookDelivery, errors: string[]): Promise<WebhookReply> {
  await recordDelivery(db, "rejected", errors.join("; "), delivery.body);
  return reply(400, { error: "Invalid event", details: errors });
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

  const decoded = decodeJson(delivery.body);
  if (!decoded.ok) return rejectDelivery(db, delivery, ["body: not valid JSON"]);

  const check = parseWebhookPayload(decoded.value);
  if (!check.ok) return rejectDelivery(db, delivery, check.errors);

  const result = await ingestEvent(db, check.event);
  await recordDelivery(db, result.status, null, delivery.body);
  return reply(200, {
    status: result.status,
    event_id: check.event.id,
    person_id: result.personId,
  });
}
