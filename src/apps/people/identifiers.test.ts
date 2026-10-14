import { count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import {
  findOrCreatePeopleByIdentifiers,
  findOrCreatePerson,
  findPeopleByIdentifiers,
  findPersonByIdentifier,
  linkIdentifiers,
  normalizeIdentifier,
} from "./identifiers";
import { identifiers, people } from "./schema";

async function countPeople(db: Db): Promise<number> {
  const [row] = await db.select({ total: count() }).from(people);
  return row.total;
}

describe("normalizeIdentifier", () => {
  it("trims and lowercases emails", () => {
    expect(normalizeIdentifier("email", "  Zoe@Example.COM ")).toBe("zoe@example.com");
  });

  it("only trims other identifiers, keeping their case", () => {
    expect(normalizeIdentifier("user_id", " u_2B6447a3 ")).toBe("u_2B6447a3");
  });
});

describe("people identifiers", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  describe("findOrCreatePeopleByIdentifiers", () => {
    it("creates one person per new value", async () => {
      const found = await findOrCreatePeopleByIdentifiers(
        db,
        "email",
        ["a@example.com", "b@example.com"],
        "newsletter",
      );

      expect(found.size).toBe(2);
      expect(found.get("a@example.com")).not.toBe(found.get("b@example.com"));
      expect(await countPeople(db)).toBe(2);
    });

    it("returns the same person when called again", async () => {
      const first = await findOrCreatePeopleByIdentifiers(db, "email", ["a@example.com"], "newsletter");
      const second = await findOrCreatePeopleByIdentifiers(db, "email", ["a@example.com"], "web");

      expect(second.get("a@example.com")).toBe(first.get("a@example.com"));
      expect(await countPeople(db)).toBe(1);
    });

    it("treats case and padding variants of an email as one person", async () => {
      const found = await findOrCreatePeopleByIdentifiers(
        db,
        "email",
        ["a@example.com", "A@Example.com", "  a@example.com "],
        "newsletter",
      );

      expect(found.size).toBe(1);
      expect(await countPeople(db)).toBe(1);
    });

    it("creates only the people who are missing", async () => {
      await findOrCreatePeopleByIdentifiers(db, "email", ["a@example.com"], "newsletter");
      const found = await findOrCreatePeopleByIdentifiers(
        db,
        "email",
        ["a@example.com", "b@example.com"],
        "newsletter",
      );

      expect(found.size).toBe(2);
      expect(await countPeople(db)).toBe(2);
    });

    it("records which app first linked the identifier", async () => {
      await findOrCreatePeopleByIdentifiers(db, "email", ["a@example.com"], "mobile");
      const [row] = await db.select().from(identifiers);

      expect(row).toMatchObject({ type: "email", value: "a@example.com", source: "mobile" });
    });

    it("does nothing for an empty list", async () => {
      const found = await findOrCreatePeopleByIdentifiers(db, "email", [], "newsletter");

      expect(found.size).toBe(0);
      expect(await countPeople(db)).toBe(0);
    });

    it("handles more values than fit in one statement", async () => {
      const emails = Array.from({ length: 1200 }, (_, i) => `person${i}@example.com`);
      const found = await findOrCreatePeopleByIdentifiers(db, "email", emails, "newsletter");

      expect(found.size).toBe(1200);
      expect(await countPeople(db)).toBe(1200);
    });
  });

  describe("findPeopleByIdentifiers", () => {
    it("leaves out values nobody owns", async () => {
      await findOrCreatePeopleByIdentifiers(db, "email", ["a@example.com"], "newsletter");
      const found = await findPeopleByIdentifiers(db, "email", ["a@example.com", "nobody@example.com"]);

      expect([...found.keys()]).toEqual(["a@example.com"]);
    });

    it("keeps identifier types apart", async () => {
      await findOrCreatePeopleByIdentifiers(db, "user_id", ["u_1"], "mobile");
      const found = await findPeopleByIdentifiers(db, "visitor_id", ["u_1"]);

      expect(found.size).toBe(0);
    });
  });

  describe("linkIdentifiers", () => {
    it("points a second identifier at an existing person", async () => {
      const personId = await findOrCreatePerson(db, "email", "a@example.com", "newsletter");
      await linkIdentifiers(db, [{ personId, type: "user_id", value: "u_1" }], "mobile");

      expect(await findPersonByIdentifier(db, "user_id", "u_1")).toBe(personId);
      expect(await countPeople(db)).toBe(1);
    });

    it("leaves an identifier with its current owner", async () => {
      const owner = await findOrCreatePerson(db, "email", "a@example.com", "newsletter");
      const other = await findOrCreatePerson(db, "email", "b@example.com", "newsletter");
      await linkIdentifiers(db, [{ personId: owner, type: "visitor_id", value: "v_1" }], "web");
      await linkIdentifiers(db, [{ personId: other, type: "visitor_id", value: "v_1" }], "web");

      expect(await findPersonByIdentifier(db, "visitor_id", "v_1")).toBe(owner);
    });

    it("is safe to repeat", async () => {
      const personId = await findOrCreatePerson(db, "email", "a@example.com", "newsletter");
      const link = { personId, type: "visitor_id" as const, value: "v_1" };
      await linkIdentifiers(db, [link], "web");
      await linkIdentifiers(db, [link], "web");

      const rows = await db.select().from(identifiers).where(eq(identifiers.type, "visitor_id"));
      expect(rows).toHaveLength(1);
    });
  });

  describe("single-value helpers", () => {
    it("findPersonByIdentifier returns null for an unknown value", async () => {
      expect(await findPersonByIdentifier(db, "email", "nobody@example.com")).toBeNull();
    });

    it("findOrCreatePerson returns the same ID for a case variant", async () => {
      const first = await findOrCreatePerson(db, "email", "a@example.com", "newsletter");
      const second = await findOrCreatePerson(db, "email", "A@EXAMPLE.COM", "mobile");

      expect(second).toBe(first);
    });
  });
});
