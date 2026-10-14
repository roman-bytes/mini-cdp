import { exportFileName, segmentCsv } from "@/apps/segments/export";
import { listSegmentMembers } from "@/apps/segments/run";
import { getSegment } from "@/apps/segments/saved";
import { getLiveDb } from "@/shared/db/live";
import { getToday } from "@/shared/today";

/** GET /segments/:id/export — everyone in the segment right now, as a CSV download. */
export async function GET(_request: Request, context: RouteContext<"/segments/[id]/export">) {
  const { id } = await context.params;
  const db = await getLiveDb();
  const segment = await getSegment(db, id);
  if (!segment) return new Response("Segment not found", { status: 404 });

  const members = await listSegmentMembers(db, segment.definition, getToday());
  return new Response(segmentCsv(members), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(segment.name)}"`,
    },
  });
}
