import { channelLabel } from "@/shared/channels";
import { formatNumber, formatPercent, formatShortDate } from "@/shared/format";

import type { ReachRow, SourceEngagement, WeeklySignups } from "../../dashboard";
import type { ChartTableData } from "./chart-card";

/**
 * Turns dashboard numbers into the rows each chart and its table view draw.
 * Kept apart from the chart components so the shaping is plain, testable code.
 */

export type SignupBar = WeeklySignups & { label: string };

export function signupBars(weeks: WeeklySignups[]): SignupBar[] {
  return weeks.map((week) => ({ ...week, label: formatShortDate(week.weekStart) }));
}

export function signupTable(weeks: WeeklySignups[]): ChartTableData {
  return {
    columns: ["Week starting", "Signups"],
    rows: weeks.map((week) => [
      `${formatShortDate(week.weekStart)}${week.inProgress ? " (so far)" : ""}`,
      week.signups,
    ]),
  };
}

export type SourceBar = SourceEngagement & {
  label: string;
  /** Shown at the end of the bar, e.g. "899 · 25% not opening". */
  endLabel: string;
};

/** Subscribers who did not open in the window, lapsed or never. */
function notOpening(row: SourceEngagement): number {
  return row.lapsed + row.neverOpened;
}

export function sourceBars(rows: SourceEngagement[]): SourceBar[] {
  return rows.map((row) => ({
    ...row,
    label: row.source ? channelLabel(row.source) : "Unknown",
    endLabel: `${formatNumber(row.total)} · ${formatPercent(notOpening(row), row.total)} not opening`,
  }));
}

export function sourceTable(rows: SourceEngagement[]): ChartTableData {
  return {
    columns: ["Source", "Subscribers", "Opened in last 30 days", "Lapsed", "Never opened", "Not opening"],
    rows: sourceBars(rows).map((row) => [
      row.label,
      row.total,
      row.engaged,
      row.lapsed,
      row.neverOpened,
      formatPercent(notOpening(row), row.total),
    ]),
  };
}

export type ReachBar = ReachRow & { endLabel: string };

export function reachBars(rows: ReachRow[]): ReachBar[] {
  const total = rows.reduce((sum, row) => sum + row.subscribers, 0);
  return rows.map((row) => ({
    ...row,
    endLabel: `${formatNumber(row.subscribers)} · ${formatPercent(row.subscribers, total)}`,
  }));
}

export function reachTable(rows: ReachRow[]): ChartTableData {
  return {
    columns: ["Reachable by", "Subscribers"],
    rows: rows.map((row) => [row.label, row.subscribers]),
  };
}
