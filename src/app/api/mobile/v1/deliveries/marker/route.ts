import { latestDeliveryMarker } from "@/apps/mobile/deliveries";
import { getLiveDb } from "@/shared/db/live";

/**
 * GET /api/mobile/v1/deliveries/marker — a value that changes whenever an app
 * event arrives. Open pages poll it and reload their data only when it moves.
 */
export async function GET(): Promise<Response> {
  return Response.json({ marker: await latestDeliveryMarker(await getLiveDb()) });
}
