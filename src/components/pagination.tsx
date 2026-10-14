import Link from "next/link";

import { formatNumber } from "@/shared/format";

export type PageRange = { first: number; last: number; hasPrevious: boolean; hasNext: boolean };

/** Which rows a page shows, and whether there is a page either side of it. */
export function pageRange(page: number, pageSize: number, total: number): PageRange {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return { first, last, hasPrevious: page > 1, hasNext: last < total };
}

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Builds the link to another page of the same list. */
  hrefForPage: (page: number) => string;
};

const linkClass = "rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary";
const disabledClass = "rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-50";

/** "Showing 1–50 of 2,930" with previous and next links. */
export function Pagination({ page, pageSize, total, hrefForPage }: PaginationProps) {
  const range = pageRange(page, pageSize, total);

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        Showing {formatNumber(range.first)}–{formatNumber(range.last)} of {formatNumber(total)}
      </p>
      <div className="flex gap-2">
        {range.hasPrevious ? (
          <Link className={linkClass} href={hrefForPage(page - 1)}>
            Previous
          </Link>
        ) : (
          <span className={disabledClass}>Previous</span>
        )}
        {range.hasNext ? (
          <Link className={linkClass} href={hrefForPage(page + 1)}>
            Next
          </Link>
        ) : (
          <span className={disabledClass}>Next</span>
        )}
      </div>
    </nav>
  );
}
