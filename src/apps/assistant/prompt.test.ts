import { describe, expect, it } from "vitest";

import { findPii } from "./pii";
import { buildSystemPrompt, describeSegmentCatalog, previousMonthName } from "./prompt";

describe("previousMonthName", () => {
  it("names the calendar month before today's", () => {
    expect(previousMonthName("2026-09-28")).toBe("August 2026");
  });

  it("wraps back into the previous year in January", () => {
    expect(previousMonthName("2027-01-15")).toBe("December 2026");
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

  it("tells the model today's date and what last month means", () => {
    expect(prompt).toContain("Today is 2026-09-28.");
    expect(prompt).toContain("previous calendar month (August 2026)");
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
