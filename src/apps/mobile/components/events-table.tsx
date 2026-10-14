import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { describeProperties } from "@/apps/people/timeline";
import { formatDateTime } from "@/shared/format";

import type { AppEvent } from "../activity";

/** Who an event belongs to: a link to the person, or a tag while unknown. */
function EventOwner({ event }: { event: AppEvent }) {
  if (!event.personId) return <Badge variant="outline">Anonymous</Badge>;
  return (
    <Link className="font-medium underline-offset-4 hover:underline" href={`/people/${event.personId}`}>
      View person
    </Link>
  );
}

/** App events, newest first by the time they happened on the device. */
export function EventsTable({ events }: { events: AppEvent[] }) {
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
          <TableRow key={event.id}>
            <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(event.occurredAt)}</TableCell>
            <TableCell>
              <Badge variant="secondary">{event.event}</Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">{describeProperties(event.properties)}</TableCell>
            <TableCell className="font-mono text-sm">{event.deviceId}</TableCell>
            <TableCell className="font-mono text-sm">{event.userId ?? "—"}</TableCell>
            <TableCell>
              <EventOwner event={event} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
