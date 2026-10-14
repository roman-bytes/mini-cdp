import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { segmentPath } from "@/apps/segments/paths";
import { formatNumber } from "@/shared/format";

import type { PrivacySummary, TeammateTable } from "../runs";
import type { AssistantSegment, Replacement, RunStatus } from "../schema";

const STATUS_LABELS: Record<RunStatus, string> = {
  running: "Working",
  answered: "Answered",
  blocked: "Stopped to protect personal data",
  failed: "Could not answer",
};

export function StatusBadge({ status }: { status: RunStatus }) {
  return <Badge variant={status === "answered" ? "secondary" : "outline"}>{STATUS_LABELS[status]}</Badge>;
}

/** Shows what was swapped out of the question before it was sent. */
export function ReplacementsNote({ replacements }: { replacements: Replacement[] }) {
  if (replacements.length === 0) return null;
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Swapped out before sending</p>
      <ul className="mt-1 space-y-1 text-muted-foreground">
        {replacements.map((item) => (
          <li key={item.original}>
            <span className="font-mono">{item.original}</span> → <span className="font-mono">{item.replacement}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A table the assistant made, with people shown by email and linked to their profile. */
export function AnswerTable({ table }: { table: TeammateTable }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.title}</CardTitle>
        <CardDescription>
          {table.totalRows > table.rows.length
            ? `Showing ${formatNumber(table.rows.length)} of ${formatNumber(table.totalRows)} rows.`
            : `${formatNumber(table.totalRows)} ${table.totalRows === 1 ? "row" : "rows"}.`}
          {table.columns.includes("person") ? " Emails were added by this app; the AI saw only person keys." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[28rem] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {table.columns.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => {
                  const personId = table.personIds[rowIndex];
                  const isPersonCell = table.columns[cellIndex] === "person" && personId;
                  return (
                    <TableCell key={cellIndex} className="tabular-nums">
                      {isPersonCell ? (
                        <Link className="underline-offset-4 hover:underline" href={`/people/${personId}`}>
                          {String(cell)}
                        </Link>
                      ) : (
                        formatCell(cell)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** A cell value for display. Numbers get thousands separators; empty shows as a dash. */
export function formatCell(cell: string | number | boolean | null): string {
  if (cell === null) return "—";
  if (typeof cell === "number") return formatNumber(cell);
  return String(cell);
}

/** A segment the assistant saved, with a link to open it. */
export function AnswerSegment({ segment }: { segment: AssistantSegment }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Segment saved</CardDescription>
        <CardTitle>
          <Link className="underline-offset-4 hover:underline" href={segmentPath(segment.segmentId)}>
            {segment.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {formatNumber(segment.total)} people
        {segment.neverOpened > 0 ? ` · ${formatNumber(segment.neverOpened)} never opened` : ""}. Open it to see
        everyone, export it, or delete it.
      </CardContent>
    </Card>
  );
}

/** One line on whether anything identifying reached, or nearly reached, the AI. */
export function PrivacyCheck({ summary }: { summary: PrivacySummary }) {
  if (summary.requestsBlocked > 0) {
    return (
      <p className="text-sm">
        <strong>Privacy check stopped a request.</strong> It contained an {summary.findings.join(" and an ")}, so it
        was never sent. {summary.requestsSent} earlier {summary.requestsSent === 1 ? "request was" : "requests were"}{" "}
        sent and passed the check.
      </p>
    );
  }
  return (
    <p className="text-sm">
      <strong>Privacy check passed.</strong> {summary.requestsSent}{" "}
      {summary.requestsSent === 1 ? "request was" : "requests were"} sent to the AI, and none contained an email or a
      raw ID.
    </p>
  );
}
