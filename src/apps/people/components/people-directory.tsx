import Link from "next/link";

import { Pagination } from "@/components/pagination";
import { formatNumber } from "@/shared/format";

import type { PeoplePage } from "../directory";
import { hasFilters, PAGE_SIZES, peopleHref, sortHref, type PeopleParams } from "../people-params";
import { PeopleFilters } from "./people-filters";
import { PeopleTable } from "./people-table";

function PageSizeLinks({ params, basePath }: { params: PeopleParams; basePath: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      Rows per page:
      {PAGE_SIZES.map((size) =>
        size === params.pageSize ? (
          <span key={size} className="font-medium text-foreground" aria-current="true">
            {size}
          </span>
        ) : (
          <Link key={size} href={peopleHref({ ...params, pageSize: size, page: 1 }, basePath)} className="underline-offset-4 hover:underline">
            {size}
          </Link>
        ),
      )}
    </p>
  );
}

/** "146 people", or "146 of 229 people in this segment" when filters narrow a scoped table. */
export function countLabel(shown: number, params: PeopleParams, scope?: { total: number; name: string }): string {
  const noun = (count: number) => (count === 1 ? "person" : "people");
  if (scope && hasFilters(params.filters)) {
    return `${formatNumber(shown)} of ${formatNumber(scope.total)} ${noun(scope.total)} in ${scope.name}`;
  }
  return `${formatNumber(shown)} ${noun(shown)}`;
}

type PeopleDirectoryProps = {
  params: PeopleParams;
  result: PeoplePage;
  /** The page the table is on, e.g. /people or a saved segment's page. */
  basePath: string;
  searchLabel: string;
  /** When the table is limited to a group, such as a segment: its size and how to name it. */
  scope?: { total: number; name: string };
};

/**
 * The people table with its search, filters, sorting and paging. The People
 * page and every saved segment's page use this same table.
 */
export function PeopleDirectory({ params, result, basePath, searchLabel, scope }: PeopleDirectoryProps) {
  return (
    <div className="space-y-4">
      <PeopleFilters params={params} basePath={basePath} searchLabel={searchLabel} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{countLabel(result.total, params, scope)}</p>
        <PageSizeLinks params={params} basePath={basePath} />
      </div>
      <PeopleTable
        people={result.people}
        sorting={{ current: params.sort, hrefFor: (column) => sortHref(params, column, basePath) }}
      />
      <Pagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefForPage={(page) => peopleHref({ ...params, page }, basePath)}
      />
    </div>
  );
}
