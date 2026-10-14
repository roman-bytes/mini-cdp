import { describe, expect, it } from "vitest";

import {
  cleanWebEventRow,
  firstEmailByVisitor,
  type CleanVisit,
  type RawWebEventRow,
} from "./web-event-rows";

function rawRow(overrides: Partial<RawWebEventRow> = {}): RawWebEventRow {
  return {
    visitor_id: "v_8001a480c8",
    page: "/news/church-attendance-study",
    timestamp: "2026-06-30 20:11:42",
    utm_source: "instagram",
    email: "",
    ...overrides,
  };
}

function visit(overrides: Partial<CleanVisit> = {}): CleanVisit {
  return {
    visitorId: "v_1",
    page: "/",
    occurredAt: new Date("2026-07-01T10:00:00Z"),
    utmSource: null,
    email: null,
    ...overrides,
  };
}

describe("cleanWebEventRow", () => {
  it("cleans a good row", () => {
    expect(cleanWebEventRow(rawRow())).toEqual({
      ok: true,
      visit: {
        visitorId: "v_8001a480c8",
        page: "/news/church-attendance-study",
        occurredAt: new Date("2026-06-30T20:11:42Z"),
        utmSource: "instagram",
        email: null,
      },
    });
  });

  it("stores an untagged visit with no channel", () => {
    expect(cleanWebEventRow(rawRow({ utm_source: "" }))).toMatchObject({
      ok: true,
      visit: { utmSource: null },
    });
  });

  it("stores a twitter tag as the x channel", () => {
    expect(cleanWebEventRow(rawRow({ utm_source: "twitter" }))).toMatchObject({
      ok: true,
      visit: { utmSource: "x" },
    });
  });

  it("normalises a captured email", () => {
    expect(cleanWebEventRow(rawRow({ email: "Julia.Evans230@Gmail.com" }))).toMatchObject({
      ok: true,
      visit: { email: "julia.evans230@gmail.com" },
    });
  });

  it("keeps the visit but drops an unusable email", () => {
    expect(cleanWebEventRow(rawRow({ email: "not-an-email" }))).toMatchObject({
      ok: true,
      visit: { email: null },
    });
  });

  it("sets aside a row with no visitor ID", () => {
    expect(cleanWebEventRow(rawRow({ visitor_id: "" }))).toEqual({
      ok: false,
      reason: "Missing visitor ID",
    });
  });

  it("sets aside a row with no page", () => {
    expect(cleanWebEventRow(rawRow({ page: "" }))).toEqual({ ok: false, reason: "Missing page" });
  });

  it("sets aside a row with a bad timestamp", () => {
    expect(cleanWebEventRow(rawRow({ timestamp: "last week" }))).toEqual({
      ok: false,
      reason: "Invalid timestamp",
    });
  });
});

describe("firstEmailByVisitor", () => {
  it("maps each visitor to the email they gave", () => {
    const emails = firstEmailByVisitor([
      visit({ visitorId: "v_1" }),
      visit({ visitorId: "v_1", email: "a@example.com" }),
      visit({ visitorId: "v_2", email: "b@example.com" }),
    ]);

    expect(emails).toEqual(
      new Map([
        ["v_1", "a@example.com"],
        ["v_2", "b@example.com"],
      ]),
    );
  });

  it("leaves out visitors who never gave an email", () => {
    expect(firstEmailByVisitor([visit({ visitorId: "v_anon" })]).size).toBe(0);
  });

  it("keeps the earliest email by visit time, whatever the row order", () => {
    const emails = firstEmailByVisitor([
      visit({ email: "later@example.com", occurredAt: new Date("2026-07-05T00:00:00Z") }),
      visit({ email: "first@example.com", occurredAt: new Date("2026-07-01T00:00:00Z") }),
    ]);

    expect(emails.get("v_1")).toBe("first@example.com");
  });
});
