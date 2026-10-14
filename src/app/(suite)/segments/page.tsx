import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SegmentBuilder } from "@/apps/segments/components/segment-builder";
import { describeRule, EXAMPLE_DEFINITION, SEGMENT_FIELDS } from "@/apps/segments/definition";
import { countSegment } from "@/apps/segments/run";
import { listSegments, type SavedSegment } from "@/apps/segments/saved";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader, Section } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Db } from "@/shared/db/client";
import { getLiveDb } from "@/shared/db/live";
import { formatNumber } from "@/shared/format";
import { getToday } from "@/shared/today";

import { previewSegmentAction, saveSegmentAction } from "./actions";

export const metadata: Metadata = { title: "Segments" };

/** A saved segment's rules in one line. */
function rulesSummary(segment: SavedSegment): string {
  if (segment.definition.rules.length === 0) return "Everyone";
  const joiner = segment.definition.match === "all" ? " and " : " or ";
  return segment.definition.rules.map(describeRule).join(joiner);
}

async function SavedSegmentRow({ db, segment }: { db: Db; segment: SavedSegment }) {
  const size = await countSegment(db, segment.definition, getToday());
  return (
    <TableRow>
      <TableCell>
        <Link className="font-medium underline-offset-4 hover:underline" href={`/segments/${segment.id}`}>
          {segment.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{rulesSummary(segment)}</TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(size.total)}</TableCell>
    </TableRow>
  );
}

/** Saved segments with their size right now, counted on every request. */
async function SavedSegments() {
  const db = await getLiveDb();
  const saved = await listSegments(db);
  if (saved.length === 0) {
    return <p className="text-sm text-muted-foreground">No saved segments yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Rules</TableHead>
          <TableHead className="text-right">People now</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {saved.map((segment) => (
          <SavedSegmentRow key={segment.id} db={db} segment={segment} />
        ))}
      </TableBody>
    </Table>
  );
}

export default function SegmentsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Segments"
        description="Pick people by rules. Counts are worked out live, so new events change them straight away."
      />

      <Section title="Build a segment">
        <SegmentBuilder
          fields={SEGMENT_FIELDS}
          initial={EXAMPLE_DEFINITION}
          preview={previewSegmentAction}
          save={saveSegmentAction}
        />
      </Section>

      <Section title="Saved segments">
        <Suspense fallback={<LoadingMessage />}>
          <SavedSegments />
        </Suspense>
      </Section>
    </div>
  );
}
