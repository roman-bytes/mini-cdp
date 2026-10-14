import { describe, expect, it } from "vitest";

import {
  cleanSubscriberRow,
  mergeSubscribers,
  type CleanSubscriber,
  type RawSubscriberRow,
} from "./subscriber-rows";

function rawRow(overrides: Partial<RawSubscriberRow> = {}): RawSubscriberRow {
  return {
    email: "julia.peterson914@icloud.com",
    signup_date: "2026-08-11",
    status: "active",
    acquisition_source: "Google",
    last_open_date: "2026-09-24",
    ...overrides,
  };
}

function subscriber(overrides: Partial<CleanSubscriber> = {}): CleanSubscriber {
  return {
    email: "a@example.com",
    status: "active",
    acquisitionSource: "google",
    signupDate: "2026-08-11",
    lastOpenDate: "2026-09-24",
    ...overrides,
  };
}

describe("cleanSubscriberRow", () => {
  it("cleans a good row", () => {
    expect(cleanSubscriberRow(rawRow())).toEqual({
      ok: true,
      subscriber: {
        email: "julia.peterson914@icloud.com",
        status: "active",
        acquisitionSource: "google",
        signupDate: "2026-08-11",
        lastOpenDate: "2026-09-24",
      },
    });
  });

  it("normalises the email and the channel name", () => {
    const check = cleanSubscriberRow(
      rawRow({ email: "  Chloe.Reed603@Yahoo.Com ", acquisition_source: "X" }),
    );
    expect(check).toMatchObject({
      ok: true,
      subscriber: { email: "chloe.reed603@yahoo.com", acquisitionSource: "x" },
    });
  });

  it("stores a missing last open date as null, meaning never opened", () => {
    const check = cleanSubscriberRow(rawRow({ last_open_date: "" }));
    expect(check).toMatchObject({ ok: true, subscriber: { lastOpenDate: null } });
  });

  it("stores a missing source as null", () => {
    const check = cleanSubscriberRow(rawRow({ acquisition_source: "" }));
    expect(check).toMatchObject({ ok: true, subscriber: { acquisitionSource: null } });
  });

  it("sets aside a fully blank row", () => {
    const blank = rawRow({
      email: "",
      signup_date: "",
      status: "",
      acquisition_source: "",
      last_open_date: "",
    });
    expect(cleanSubscriberRow(blank)).toEqual({ ok: false, reason: "Blank row" });
  });

  it.each(["not-an-email", "@gmail.com", ""])("sets aside the invalid email %j", (email) => {
    expect(cleanSubscriberRow(rawRow({ email }))).toEqual({
      ok: false,
      reason: "Invalid email",
    });
  });

  it("sets aside an unknown status", () => {
    expect(cleanSubscriberRow(rawRow({ status: "paused" }))).toEqual({
      ok: false,
      reason: "Unknown status",
    });
  });

  it("sets aside a bad signup date", () => {
    expect(cleanSubscriberRow(rawRow({ signup_date: "08/11/2026" }))).toEqual({
      ok: false,
      reason: "Invalid signup date",
    });
  });

  it("sets aside a bad last open date", () => {
    expect(cleanSubscriberRow(rawRow({ last_open_date: "yesterday" }))).toEqual({
      ok: false,
      reason: "Invalid last open date",
    });
  });
});

describe("mergeSubscribers", () => {
  it("keeps the earliest signup date", () => {
    const merged = mergeSubscribers(
      subscriber({ signupDate: "2026-08-11" }),
      subscriber({ signupDate: "2026-07-01" }),
    );
    expect(merged.signupDate).toBe("2026-07-01");
  });

  it("keeps the latest open date", () => {
    const merged = mergeSubscribers(
      subscriber({ lastOpenDate: "2026-09-01" }),
      subscriber({ lastOpenDate: "2026-09-24" }),
    );
    expect(merged.lastOpenDate).toBe("2026-09-24");
  });

  it("prefers a known open date over never opened", () => {
    expect(
      mergeSubscribers(subscriber({ lastOpenDate: null }), subscriber({ lastOpenDate: "2026-09-01" }))
        .lastOpenDate,
    ).toBe("2026-09-01");
    expect(
      mergeSubscribers(subscriber({ lastOpenDate: "2026-09-01" }), subscriber({ lastOpenDate: null }))
        .lastOpenDate,
    ).toBe("2026-09-01");
  });

  it("stays never-opened when neither row has an open", () => {
    const merged = mergeSubscribers(
      subscriber({ lastOpenDate: null }),
      subscriber({ lastOpenDate: null }),
    );
    expect(merged.lastOpenDate).toBeNull();
  });

  it("lets unsubscribed beat active, whichever row comes first", () => {
    expect(
      mergeSubscribers(subscriber({ status: "active" }), subscriber({ status: "unsubscribed" })).status,
    ).toBe("unsubscribed");
    expect(
      mergeSubscribers(subscriber({ status: "unsubscribed" }), subscriber({ status: "active" })).status,
    ).toBe("unsubscribed");
  });

  it("keeps the first known source", () => {
    expect(
      mergeSubscribers(
        subscriber({ acquisitionSource: null }),
        subscriber({ acquisitionSource: "instagram" }),
      ).acquisitionSource,
    ).toBe("instagram");
    expect(
      mergeSubscribers(
        subscriber({ acquisitionSource: "google" }),
        subscriber({ acquisitionSource: "instagram" }),
      ).acquisitionSource,
    ).toBe("google");
  });
});
