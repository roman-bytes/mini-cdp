import Link from "next/link";

import { NewLabel, RecentRow } from "@/components/recent-row";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/shared/format";

import type { TimelineEntry, TimelineSource } from "../timeline";

export const SOURCE_LABELS: Record<TimelineSource, string> = { web: "Web", app: "App" };

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "web", label: "Web" },
  { value: "app", label: "App" },
];

/** Links that narrow the timeline to one source. */
export function TimelineFilter({ basePath, current }: { basePath: string; current: string }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Filter timeline">
      {FILTERS.map((filter) => (
        <Link
          key={filter.value}
          href={filter.value === "all" ? basePath : `${basePath}?source=${filter.value}`}
          aria-current={filter.value === current ? "true" : undefined}
          className={
            filter.value === current
              ? "rounded-md bg-secondary px-3 py-1 text-sm font-medium"
              : "rounded-md px-3 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          }
        >
          {filter.label}
        </Link>
      ))}
    </div>
  );
}

type TimelineTableProps = {
  entries: TimelineEntry[];
  /** When the server drew the page, in milliseconds. Decides which rows are new. */
  renderedAt: number;
};

/**
 * Everything a person did on the website and in the app, newest first. App
 * events that arrived in the last hour are green.
 */
export function TimelineTable({ entries, renderedAt }: TimelineTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity to show.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>What</TableHead>
          <TableHead>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <RecentRow key={entry.key} arrivedAt={entry.arrivedAt} renderedAt={renderedAt}>
            <TableCell className="whitespace-nowrap tabular-nums">
              {formatDateTime(entry.at)}
              <NewLabel />
            </TableCell>
            <TableCell>
              <Badge variant={entry.source === "app" ? "secondary" : "outline"}>
                {SOURCE_LABELS[entry.source]}
              </Badge>
            </TableCell>
            <TableCell>
              {entry.action}
              {entry.subject ? <span className="ml-2 font-mono text-sm">{entry.subject}</span> : null}
            </TableCell>
            <TableCell className="text-muted-foreground">{entry.detail}</TableCell>
          </RecentRow>
        ))}
      </TableBody>
    </Table>
  );
}
