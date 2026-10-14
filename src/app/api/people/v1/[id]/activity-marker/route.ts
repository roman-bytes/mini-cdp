import { personActivityMarker } from "@/apps/mobile/activity";
import { getLiveDb } from "@/shared/db/live";
import { isUuid } from "@/shared/ids";

/**
 * GET /api/people/v1/:id/activity-marker — a value that changes whenever the
 * person gains an app event. Their open profile polls it.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/people/v1/[id]/activity-marker">,
): Promise<Response> {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Not a person ID" }, { status: 404 });
  return Response.json({ marker: await personActivityMarker(await getLiveDb(), id) });
}
