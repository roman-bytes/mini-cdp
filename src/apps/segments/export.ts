import { toCsv, type CsvValue } from "@/shared/csv";

import type { SegmentMember } from "./run";

const EXPORT_HEADERS = [
  "email",
  "type",
  "status",
  "source",
  "signup_date",
  "last_open_date",
  "never_opened",
  "web_visits",
  "app_events",
  "has_app_account",
];

function exportRow(member: SegmentMember): CsvValue[] {
  return [
    member.email,
    member.kind,
    member.status,
    member.acquisitionSource,
    member.signupDate,
    member.lastOpenDate,
    member.neverOpened,
    member.webVisitCount,
    member.appEventCount,
    member.hasAppAccount,
  ];
}

/** A segment's people as CSV text, ready to load into another tool. */
export function segmentCsv(members: SegmentMember[]): string {
  return toCsv(EXPORT_HEADERS, members.map(exportRow));
}

/** A safe file name for a segment's export. */
export function exportFileName(segmentName: string): string {
  const slug = segmentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "segment"}.csv`;
}
