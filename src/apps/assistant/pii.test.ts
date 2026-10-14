import { beforeAll, describe, expect, it } from "vitest";

import { findOrCreatePerson, linkIdentifiers } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { findPii, personReference, scrubQuestion } from "./pii";

describe("findPii", () => {
  it("finds an email address, in any case", () => {
    expect(findPii("what did Julia.Evans230@Gmail.com read?")).toEqual(["email address"]);
  });

  it("finds raw app, web and device IDs", () => {
    expect(findPii("u_2b6447a3 on d_4b21e8 was v_8001a480c8")).toEqual([
      "app user ID",
      "web visitor ID",
      "app device ID",
    ]);
  });

  it("finds nothing in ordinary analytics text", () => {
    expect(findPii("select page, count(*) from web_visits group by page")).toEqual([]);
    expect(findPii('{"person_key":"3f6972bf-3046-4a1b-a662-47e26413d514"}')).toEqual([]);
  });

  it("can be called again on the same text with the same result", () => {
    const text = "a@b.com";
    expect(findPii(text)).toEqual(findPii(text));
  });
});

describe("personReference", () => {
  it("refers to a person by key, or says nobody matched", () => {
    expect(personReference("abc")).toBe("[person abc]");
    expect(personReference(null)).toBe("[someone not in the data]");
  });
});

describe("scrubQuestion", () => {
  let db: Db;
  let julia: string;

  beforeAll(async () => {
    db = await createTestDb();
    julia = await findOrCreatePerson(db, "email", "julia.evans230@gmail.com", "newsletter");
    await linkIdentifiers(db, [{ personId: julia, type: "user_id", value: "u_2b6447a3" }], "mobile");
  });

  it("swaps an email for the person's opaque key", async () => {
    const scrubbed = await scrubQuestion(db, "What did JULIA.EVANS230@GMAIL.COM read last week?");

    expect(scrubbed.text).toBe(`What did [person ${julia}] read last week?`);
    expect(scrubbed.replacements).toEqual([
      { original: "JULIA.EVANS230@GMAIL.COM", replacement: `[person ${julia}]` },
    ]);
  });

  it("swaps a raw ID too, resolving it to the same person", async () => {
    const scrubbed = await scrubQuestion(db, "Is u_2b6447a3 still opening?");

    expect(scrubbed.text).toBe(`Is [person ${julia}] still opening?`);
  });

  it("removes an email that matches nobody, without saying who it was", async () => {
    const scrubbed = await scrubQuestion(db, "Did stranger@example.com sign up?");

    expect(scrubbed.text).toBe("Did [someone not in the data] sign up?");
    expect(findPii(scrubbed.text)).toEqual([]);
  });

  it("leaves a question with nothing identifying unchanged", async () => {
    const question = "How many Instagram signups went cold last month?";

    expect(await scrubQuestion(db, question)).toEqual({ text: question, replacements: [] });
  });
});
