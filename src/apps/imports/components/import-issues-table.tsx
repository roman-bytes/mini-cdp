import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RowOutcome } from "@/shared/raw/schema";

import type { ImportIssue } from "../report";

/** How each outcome reads on screen. */
export const OUTCOME_LABELS: Record<RowOutcome, string> = {
  loaded: "Loaded",
  merged: "Merged",
  set_aside: "Set aside",
};

function OutcomeBadge({ outcome }: { outcome: RowOutcome }) {
  return (
    <Badge variant={outcome === "set_aside" ? "outline" : "secondary"}>
      {OUTCOME_LABELS[outcome]}
    </Badge>
  );
}

/** Every source row that was merged or set aside, with the reason. */
export function ImportIssuesTable({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">Every row loaded cleanly.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File</TableHead>
          <TableHead className="text-right">Line</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Value as written</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map((issue) => (
          <TableRow key={`${issue.file}:${issue.rowNumber}`}>
            <TableCell className="font-mono text-sm">{issue.file}</TableCell>
            <TableCell className="text-right tabular-nums">{issue.rowNumber}</TableCell>
            <TableCell>
              <OutcomeBadge outcome={issue.outcome} />
            </TableCell>
            <TableCell>{issue.reason}</TableCell>
            <TableCell className="font-mono text-sm whitespace-pre">
              {issue.value ? issue.value : <span className="text-muted-foreground">(empty)</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
