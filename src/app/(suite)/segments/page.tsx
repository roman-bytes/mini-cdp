import type { Metadata } from "next";
import Link from "next/link";

import { SegmentBuilder } from "@/apps/segments/components/segment-builder";
import { EXAMPLE_DEFINITION, SEGMENT_FIELDS } from "@/apps/segments/definition";
import { SAVED_SEGMENTS_PATH } from "@/apps/segments/paths";
import { PageHeader } from "@/components/page-header";

import { previewSegmentAction, saveSegmentAction } from "./actions";

export const metadata: Metadata = { title: "Segments" };

export default function SegmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Build a segment"
        description="Pick people by rules. The count is worked out live, so new events change it straight away."
      >
        <Link className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-secondary" href={SAVED_SEGMENTS_PATH}>
          Saved segments
        </Link>
      </PageHeader>
      <SegmentBuilder
        fields={SEGMENT_FIELDS}
        initial={EXAMPLE_DEFINITION}
        preview={previewSegmentAction}
        save={saveSegmentAction}
      />
    </div>
  );
}
