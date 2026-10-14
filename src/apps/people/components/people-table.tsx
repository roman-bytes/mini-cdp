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

import type { PeopleSort, Profile, SortColumn } from "../directory";
import { EMPTY, KindBadge, LastOpen, personName, sourceLabel, statusLabel } from "./person-labels";

/** How the table's column headers sort: the current order, and the link for each column. */
export type TableSorting = {
  current: PeopleSort;
  hrefFor: (column: SortColumn) => string;
};

type HeaderProps = { label: string; column: SortColumn; sorting?: TableSorting; alignRight?: boolean };

/** A column header. With sorting, it is a link that sorts by the column, and shows which way. */
function SortableHead({ label, column, sorting, alignRight }: HeaderProps) {
  const className = alignRight ? "text-right" : undefined;
  if (!sorting) return <TableHead className={className}>{label}</TableHead>;

  const isCurrent = sorting.current.column === column;
  const ascending = sorting.current.direction === "asc";
  return (
    <TableHead className={className} aria-sort={isCurrent ? (ascending ? "ascending" : "descending") : "none"}>
      <Link href={sorting.hrefFor(column)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        <span aria-hidden className={isCurrent ? "" : "opacity-0"}>
          {isCurrent && !ascending ? "↓" : "↑"}
        </span>
      </Link>
    </TableHead>
  );
}

/** A list of people. Each row links to that person's profile. */
export function PeopleTable({ people, sorting }: { people: Profile[]; sorting?: TableSorting }) {
  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody matches.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="Person" column="email" sorting={sorting} />
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
          <SortableHead label="Signed up" column="signup_date" sorting={sorting} />
          <SortableHead label="Last open" column="last_open" sorting={sorting} />
          <SortableHead label="Web visits" column="web_visits" sorting={sorting} alignRight />
          <SortableHead label="App events" column="app_events" sorting={sorting} alignRight />
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
