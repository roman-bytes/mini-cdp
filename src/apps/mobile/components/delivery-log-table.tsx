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
import { formatDateTimeSeconds } from "@/shared/format";

import type { DeliveryLogEntry } from "../deliveries";
import type { DeliveryOutcome, DeliverySource } from "../schema";
import { EventOwner } from "./event-owner";

export const OUTCOME_LABELS: Record<DeliveryOutcome, string> = {
  accepted: "Stored",
  duplicate: "Duplicate",
  rejected: "Rejected",
};

export const SOURCE_LABELS: Record<DeliverySource, string> = {
  webhook: "Webhook",
  simulator: "Simulator",
};

const OUTCOME_BADGES: Record<DeliveryOutcome, "secondary" | "outline" | "destructive"> = {
  accepted: "secondary",
  duplicate: "outline",
  rejected: "destructive",
};

/** What happened to a delivery, and for a refused one, why. */
function OutcomeCell({ entry }: { entry: DeliveryLogEntry }) {
  return (
    <TableCell>
      <Badge variant={OUTCOME_BADGES[entry.outcome]}>{OUTCOME_LABELS[entry.outcome]}</Badge>
      {entry.reason ? <p className="mt-1 max-w-xs text-xs whitespace-normal text-destructive">{entry.reason}</p> : null}
    </TableCell>
  );
}

/** A plain value from the body, or a dash when the body did not have it. */
function BodyValue({ value }: { value: string | null }) {
  return <TableCell className="font-mono text-sm">{value ?? "—"}</TableCell>;
}

type DeliveryLogTableProps = {
  entries: DeliveryLogEntry[];
  /** When the server drew the page, in milliseconds. Decides which rows are new. */
  renderedAt: number;
};

/**
 * Every delivery, newest arrival first, with what was done with it.
 * Deliveries from the last hour are green.
 */
export function DeliveryLogTable({ entries, renderedAt }: DeliveryLogTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing has been sent yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Received</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>User ID</TableHead>
          <TableHead>Device</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Belongs to</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <RecentRow key={entry.id} arrivedAt={entry.receivedAt} renderedAt={renderedAt}>
            <TableCell className="whitespace-nowrap tabular-nums">
              {formatDateTimeSeconds(entry.receivedAt)}
              <NewLabel />
            </TableCell>
            <OutcomeCell entry={entry} />
            <BodyValue value={entry.event} />
            <BodyValue value={entry.userId} />
            <BodyValue value={entry.deviceId} />
            <TableCell>{SOURCE_LABELS[entry.source]}</TableCell>
            <TableCell>{entry.outcome === "rejected" ? "—" : <EventOwner personId={entry.personId} />}</TableCell>
          </RecentRow>
        ))}
      </TableBody>
    </Table>
  );
}
