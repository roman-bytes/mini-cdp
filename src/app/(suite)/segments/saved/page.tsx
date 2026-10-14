import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SavedSegmentsTable, type SavedSegmentRow } from "@/apps/segments/components/saved-segments-table";
import { countSegment } from "@/apps/segments/run";
import { listSegments } from "@/apps/segments/saved";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { getToday } from "@/shared/today";

export const metadata: Metadata = { title: "Saved segments" };

/** Saved segments with their size right now, counted on every request. */
async function SavedSegments() {
  const db = await getLiveDb();
  const today = getToday();
  const rows: SavedSegmentRow[] = [];
  for (const segment of await listSegments(db)) {
    rows.push({ ...segment, size: await countSegment(db, segment.definition, today) });
  }
  return <SavedSegmentsTable segments={rows} />;
}

export default function SavedSegmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved segments"
        description="Segments saved from the builder or by the assistant. Sizes are counted live, so new events change them straight away."
      >
        <Link className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary" href="/segments">
          Build a segment
        </Link>
      </PageHeader>
      <Suspense fallback={<LoadingMessage />}>
        <SavedSegments />
      </Suspense>
    </div>
  );
}
