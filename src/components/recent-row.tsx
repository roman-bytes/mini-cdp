"use client";

import { TableRow } from "@/components/ui/table";
import { useNow } from "@/hooks/use-now";
import { isRecent } from "@/shared/recent";

type RecentRowProps = {
  /** When the row's data arrived. Null for data that was imported, not sent live. */
  arrivedAt: Date | null;
  /** The time the server drew the page, in milliseconds. */
  renderedAt: number;
  children: React.ReactNode;
};

/**
 * A table row that turns green while what it shows arrived in the last hour,
 * and goes back to normal once the hour is up, even if the page stays open.
 */
export function RecentRow({ arrivedAt, renderedAt, children }: RecentRowProps) {
  const now = useNow(renderedAt);
  const recent = arrivedAt !== null && isRecent(arrivedAt, now);

  return (
    <TableRow
      data-recent={recent ? "true" : undefined}
      className="group/recent data-[recent=true]:bg-emerald-500/12 data-[recent=true]:hover:bg-emerald-500/18"
    >
      {children}
    </TableRow>
  );
}

/**
 * "New", shown only inside a RecentRow that is green, so the highlight is not
 * told by colour alone.
 */
export function NewLabel() {
  return (
    <span className="ml-2 hidden rounded-4xl bg-emerald-600 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide text-white uppercase group-data-[recent=true]/recent:inline">
      New
    </span>
  );
}
