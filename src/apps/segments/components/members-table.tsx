import Link from "next/link";

import {
  EMPTY,
  LastOpen,
  personName,
  sourceLabel,
  statusLabel,
} from "@/apps/people/components/person-labels";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/shared/format";

import type { SegmentMember } from "../run";

/** The people in a segment. Subscribers who never opened carry a tag. */
export function MembersTable({ members }: { members: SegmentMember[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody matches these rules.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Signed up</TableHead>
          <TableHead>Last open</TableHead>
          <TableHead>App account</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.personId}>
            <TableCell>
              <Link className="font-medium underline-offset-4 hover:underline" href={`/people/${member.personId}`}>
                {personName(member)}
              </Link>
            </TableCell>
            <TableCell>{statusLabel(member.status)}</TableCell>
            <TableCell>{sourceLabel(member.acquisitionSource)}</TableCell>
            <TableCell>{member.signupDate ? formatDate(member.signupDate) : EMPTY}</TableCell>
            <TableCell>
              <LastOpen profile={member} />
            </TableCell>
            <TableCell>{member.hasAppAccount ? "Yes" : "No"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** "229 people · 146 never opened". */
export function SegmentSizeLine({ total, neverOpened }: { total: number; neverOpened: number }) {
  return (
    <p className="text-sm">
      <span className="text-2xl font-semibold tabular-nums">{total.toLocaleString("en-US")}</span>{" "}
      {total === 1 ? "person" : "people"}
      {neverOpened > 0 ? (
        <span className="text-muted-foreground"> · {neverOpened.toLocaleString("en-US")} never opened</span>
      ) : null}
    </p>
  );
}
