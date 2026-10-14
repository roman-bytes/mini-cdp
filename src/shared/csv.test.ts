import { describe, expect, it } from "vitest";

import { parseCsv, requireColumns, toCsv } from "./csv";

describe("parseCsv", () => {
  it("returns one object per data row, keyed by the header", () => {
    const rows = parseCsv("email,status\na@b.com,active\nc@d.com,unsubscribed\n");
    expect(rows).toEqual([
      { email: "a@b.com", status: "active" },
      { email: "c@d.com", status: "unsubscribed" },
    ]);
  });

  it("keeps values exactly as written, padding and case included", () => {
    const rows = parseCsv("email\n  Zoe@Example.COM \n");
    expect(rows[0].email).toBe("  Zoe@Example.COM ");
  });

  it("keeps a row whose every value is empty", () => {
    const rows = parseCsv("email,status\n,\na@b.com,active\n");
    expect(rows).toEqual([
      { email: "", status: "" },
      { email: "a@b.com", status: "active" },
    ]);
  });

  it("ignores a byte-order mark at the start of the file", () => {
    const rows = parseCsv("﻿email\na@b.com\n");
    expect(rows).toEqual([{ email: "a@b.com" }]);
  });
});

describe("requireColumns", () => {
  it("passes when every column is present", () => {
    expect(() =>
      requireColumns("file.csv", [{ email: "a", status: "b" }], ["email", "status"]),
    ).not.toThrow();
  });

  it("names the missing columns", () => {
    expect(() =>
      requireColumns("file.csv", [{ email: "a" }], ["email", "status", "source"]),
    ).toThrow("file.csv is missing column(s): status, source");
  });

  it("passes for a file with no data rows", () => {
    expect(() => requireColumns("file.csv", [], ["email"])).not.toThrow();
  });
});

describe("toCsv", () => {
  it("writes a header row and data rows", () => {
    expect(toCsv(["email", "visits"], [["a@b.com", 3], ["c@d.com", 0]])).toBe(
      "email,visits\na@b.com,3\nc@d.com,0\n",
    );
  });

  it("writes null as an empty cell and booleans as words", () => {
    expect(toCsv(["a", "b"], [[null, true]])).toBe("a,b\n,true\n");
  });

  it("quotes values that contain commas, quotes or line breaks", () => {
    expect(toCsv(["note"], [['say "hi", twice']])).toBe('note\n"say ""hi"", twice"\n');
  });

  it("stops a value from being run as a spreadsheet formula", () => {
    expect(toCsv(["value"], [["=SUM(A1:A9)"]])).toBe("value\n'=SUM(A1:A9)\n");
  });

  it("round-trips through parseCsv", () => {
    const csv = toCsv(["email", "note"], [["a@b.com", "one, two"]]);

    expect(parseCsv(csv)).toEqual([{ email: "a@b.com", note: "one, two" }]);
  });
});
