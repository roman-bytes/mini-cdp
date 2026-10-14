import { describe, expect, it } from "vitest";

import { findPii } from "./pii";
import { buildSystemPrompt, describeSegmentCatalog, previousMonthName, previousMonthRange } from "./prompt";

describe("previousMonthName", () => {
  it("names the calendar month before today's", () => {
    expect(previousMonthName("2026-09-28")).toBe("August 2026");
  });

  it("wraps back into the previous year in January", () => {
    expect(previousMonthName("2027-01-15")).toBe("December 2026");
  });
});

describe("previousMonthRange", () => {
  it("gives the first and last day of last month", () => {
    expect(previousMonthRange("2026-09-28")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(previousMonthRange("2026-03-15")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(previousMonthRange("2027-01-02")).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});

describe("describeSegmentCatalog", () => {
  it("lists every field with its operators and values", () => {
    const catalog = describeSegmentCatalog();

    expect(catalog).toContain("- source (Signup source): is (choice), is_not (choice); values: instagram,");
    expect(catalog).toContain("- last_open (Last email open): not_within_days (number), within_days (number), never (no value)");
  });
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt("2026-09-28");

  it("tells the model today's date and the exact dates of last month", () => {
    expect(prompt).toContain("Today is 2026-09-28.");
    expect(prompt).toContain("previous calendar month, August 2026: dates from 2026-08-01 to 2026-08-31");
  });

  it("gives the exact cutoff date for engaged and cold, matching the segment builder", () => {
    expect(prompt).toContain("last_open_date >= '2026-08-29'");
    expect(prompt).toContain("last_open_date < '2026-08-29' or last_open_date is null");
  });

  it("has Postgres do day arithmetic from today's date", () => {
    expect(prompt).toContain("compare with date '2026-09-28' - N");
  });

  it("tells the model to report a segment's own size instead of querying the same people", () => {
    expect(prompt).toContain("report the number of people create_segment returns");
  });

  it("pins down the team's readings of the brief's questions", () => {
    expect(prompt).toContain("earliest web visit of all, by occurred_at, whether before or after they signed up");
    expect(prompt).toContain("last_open within_days 7 and web_visits at_least 5");
  });

  it("describes only the PII-free views", () => {
    expect(prompt).toContain("person_key uuid");
    expect(prompt).not.toMatch(/\bemail text\b/);
    expect(prompt).not.toContain("identifiers");
  });

  it("contains nothing identifying itself", () => {
    expect(findPii(prompt)).toEqual([]);
  });
});
