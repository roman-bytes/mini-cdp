import { describeProperties } from "@/apps/people/timeline";
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

import type { AppEvent } from "../activity";
import { EventOwner } from "./event-owner";

type EventsTableProps = {
  events: AppEvent[];
  /** When the server drew the page, in milliseconds. Decides which rows are new. */
  renderedAt: number;
};

/**
 * App events, newest first by the time they happened on the device. Events
 * that arrived in the last hour are green.
 */
export function EventsTable({ events, renderedAt }: EventsTableProps) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No app events have arrived yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Happened</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Detail</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>User ID</TableHead>
          <TableHead>Belongs to</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <RecentRow key={event.id} arrivedAt={event.receivedAt} renderedAt={renderedAt}>
            <TableCell className="whitespace-nowrap tabular-nums">
              {formatDateTime(event.occurredAt)}
              <NewLabel />
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{event.event}</Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">{describeProperties(event.properties)}</TableCell>
            <TableCell className="font-mono text-sm">{event.deviceId}</TableCell>
            <TableCell className="font-mono text-sm">{event.userId ?? "—"}</TableCell>
            <TableCell>
              <EventOwner personId={event.personId} />
            </TableCell>
          </RecentRow>
        ))}
      </TableBody>
    </Table>
  );
}
