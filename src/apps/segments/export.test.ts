import { describe, expect, it } from "vitest";

import { parseCsv } from "@/shared/csv";

import { exportFileName, segmentCsv } from "./export";
import type { SegmentMember } from "./run";

const MEMBER: SegmentMember = {
  personId: "3f6972bf-3046-4a1b-a662-47e26413d514",
  email: "a@example.com",
  kind: "subscriber",
  status: "active",
  acquisitionSource: "instagram",
  signupDate: "2026-08-01",
  lastOpenDate: null,
  hasAppAccount: true,
  appAccountCreatedOn: "2026-08-22",
  webVisitCount: 4,
  firstVisitAt: null,
  lastVisitAt: null,
  appEventCount: 2,
  lastAppEventAt: null,
  neverOpened: true,
};

describe("segmentCsv", () => {
  it("writes one row per person under a header", () => {
    expect(parseCsv(segmentCsv([MEMBER]))).toEqual([
      {
        email: "a@example.com",
        type: "subscriber",
        status: "active",
        source: "instagram",
        signup_date: "2026-08-01",
        last_open_date: "",
        never_opened: "true",
        web_visits: "4",
        app_events: "2",
        has_app_account: "true",
      },
    ]);
  });

  it("writes just the header for an empty segment", () => {
    expect(segmentCsv([]).trim().split("\n")).toHaveLength(1);
  });
});

describe("exportFileName", () => {
  it("turns a name into a safe file name", () => {
    expect(exportFileName("Cold Instagram (30 days)!")).toBe("cold-instagram-30-days.csv");
  });

  it("falls back when the name has nothing usable", () => {
    expect(exportFileName("???")).toBe("segment.csv");
  });
});
