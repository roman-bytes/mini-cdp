import { describe, expect, it } from "vitest";

import { cleanAppUserRow, type RawAppUserRow } from "./app-user-rows";

function rawRow(overrides: Partial<RawAppUserRow> = {}): RawAppUserRow {
  return {
    user_id: "u_2b6447a3",
    email: "julia.evans230@gmail.com",
    created_at: "2026-08-22",
    ...overrides,
  };
}

describe("cleanAppUserRow", () => {
  it("cleans a good row", () => {
    expect(cleanAppUserRow(rawRow())).toEqual({
      ok: true,
      appUser: {
        userId: "u_2b6447a3",
        email: "julia.evans230@gmail.com",
        createdOn: "2026-08-22",
      },
    });
  });

  it("lowercases an upper-case email so it matches the subscriber", () => {
    const check = cleanAppUserRow(rawRow({ email: "PAUL.GARCIA558@GMAIL.COM" }));
    expect(check).toMatchObject({ ok: true, appUser: { email: "paul.garcia558@gmail.com" } });
  });

  it("sets aside a row with no user ID", () => {
    expect(cleanAppUserRow(rawRow({ user_id: " " }))).toEqual({
      ok: false,
      reason: "Missing user ID",
    });
  });

  it("sets aside a row with an invalid email", () => {
    expect(cleanAppUserRow(rawRow({ email: "nope" }))).toEqual({
      ok: false,
      reason: "Invalid email",
    });
  });

  it("sets aside a row with a bad created date", () => {
    expect(cleanAppUserRow(rawRow({ created_at: "22 Aug 2026" }))).toEqual({
      ok: false,
      reason: "Invalid created date",
    });
  });
});
