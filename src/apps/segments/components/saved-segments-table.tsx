import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatNumber } from "@/shared/format";

import { describeRule } from "../definition";
import { segmentPath } from "../paths";
import type { SegmentSize } from "../run";
import type { SavedSegment } from "../saved";

/** A saved segment's rules in one line. */
export function rulesSummary(segment: Pick<SavedSegment, "definition">): string {
  if (segment.definition.rules.length === 0) return "Everyone";
  const joiner = segment.definition.match === "all" ? " and " : " or ";
  return segment.definition.rules.map(describeRule).join(joiner);
}

export type SavedSegmentRow = SavedSegment & { size: SegmentSize };

/** Every saved segment with its rules and how many people it holds right now. */
export function SavedSegmentsTable({ segments }: { segments: SavedSegmentRow[] }) {
  if (segments.length === 0) {
    return <p className="text-sm text-muted-foreground">No saved segments yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Rules</TableHead>
          <TableHead className="text-right">People now</TableHead>
          <TableHead className="text-right">Never opened</TableHead>
          <TableHead>Saved</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {segments.map((segment) => (
          <TableRow key={segment.id}>
            <TableCell>
              <Link className="font-medium underline-offset-4 hover:underline" href={segmentPath(segment.id)}>
                {segment.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-md whitespace-normal text-muted-foreground">{rulesSummary(segment)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(segment.size.total)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(segment.size.neverOpened)}</TableCell>
            <TableCell className="whitespace-nowrap">{formatDate(segment.createdAt.toISOString().slice(0, 10))}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
