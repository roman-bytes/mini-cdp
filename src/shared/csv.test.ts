import { describe, expect, it } from "vitest";

import { parseCsv, requireColumns } from "./csv";

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
