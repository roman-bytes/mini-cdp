import { describe, expect, it } from "vitest";

import { isValidEmail, normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("lowercases the address", () => {
    expect(normalizeEmail("PAUL.GARCIA558@GMAIL.COM")).toBe(
      "paul.garcia558@gmail.com",
    );
  });

  it("trims padding spaces", () => {
    expect(normalizeEmail("  zoe.allen235@gmail.com ")).toBe(
      "zoe.allen235@gmail.com",
    );
  });

  it("keeps Gmail dots and plus tags, so different people stay different", () => {
    expect(normalizeEmail("a.b+news@gmail.com")).toBe("a.b+news@gmail.com");
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("julia.evans230@gmail.com")).toBe(true);
  });

  it.each(["", "not-an-email", "@gmail.com", "name@", "name@domain", "a b@c.com"])(
    "rejects %j",
    (value) => {
      expect(isValidEmail(value)).toBe(false);
    },
  );
});
