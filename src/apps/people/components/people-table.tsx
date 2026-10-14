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

import type { Profile } from "../directory";
import { EMPTY, KindBadge, LastOpen, personName, sourceLabel, statusLabel } from "./person-labels";

/** A list of people. Each row links to that person's profile. */
export function PeopleTable({ people }: { people: Profile[] }) {
  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody matches.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Signed up</TableHead>
          <TableHead>Last open</TableHead>
          <TableHead className="text-right">Web visits</TableHead>
          <TableHead className="text-right">App events</TableHead>
          <TableHead>App account</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => (
          <TableRow key={person.personId}>
            <TableCell>
              <Link className="font-medium underline-offset-4 hover:underline" href={`/people/${person.personId}`}>
                {personName(person)}
              </Link>
            </TableCell>
            <TableCell>
              <KindBadge kind={person.kind} />
            </TableCell>
            <TableCell>{statusLabel(person.status)}</TableCell>
            <TableCell>{sourceLabel(person.acquisitionSource)}</TableCell>
            <TableCell>{person.signupDate ? formatDate(person.signupDate) : EMPTY}</TableCell>
            <TableCell>
              <LastOpen profile={person} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(person.webVisitCount)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatNumber(person.appEventCount)}</TableCell>
            <TableCell>{person.hasAppAccount ? "Yes" : "No"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
