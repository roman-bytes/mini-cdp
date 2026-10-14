import { handleWebhookDelivery, MAX_BODY_BYTES } from "@/apps/mobile/webhook";
import { getDb } from "@/shared/db/client";

/**
 * POST /webhooks/app — the mobile app sends one event per request.
 * Send the API key as "Authorization: Bearer <key>".
 */
export async function POST(request: Request): Promise<Response> {
  // Refuse an oversized body before reading it into memory.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large" }, { status: 413 });
  }

  const reply = await handleWebhookDelivery(getDb(), {
    authorization: request.headers.get("authorization"),
    body: await request.text(),
  });
  return Response.json(reply.body, { status: reply.status });
}
