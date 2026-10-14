import { describe, expect, it } from "vitest";

import { withExplicitSslMode } from "./connection";

describe("withExplicitSslMode", () => {
  it("spells out verify-full for a Neon-style connection string", () => {
    expect(
      withExplicitSslMode(
        "postgresql://owner:p%40ss@ep-cool-name-123-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      ),
    ).toBe(
      "postgresql://owner:p%40ss@ep-cool-name-123-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require",
    );
  });

  it.each(["prefer", "verify-ca"])("treats sslmode=%s the same way", (mode) => {
    expect(withExplicitSslMode(`postgres://u:p@host/db?sslmode=${mode}`)).toBe(
      "postgres://u:p@host/db?sslmode=verify-full",
    );
  });

  it("leaves a string with no sslmode, or another mode, exactly as it was", () => {
    expect(withExplicitSslMode("postgres://u:p@localhost:5432/db")).toBe("postgres://u:p@localhost:5432/db");
    expect(withExplicitSslMode("postgres://u:p@host/db?sslmode=disable")).toBe("postgres://u:p@host/db?sslmode=disable");
    expect(withExplicitSslMode("postgres://u:p@host/db?sslmode=verify-full")).toBe(
      "postgres://u:p@host/db?sslmode=verify-full",
    );
  });

  it("leaves something that is not a URL alone", () => {
    expect(withExplicitSslMode("not a url")).toBe("not a url");
  });
});
