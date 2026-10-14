import { index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * People is the one place a person lives. Emails and every other identifier
 * are stored only in this schema; the other apps store a person ID.
 */
export const peopleSchema = pgSchema("people");

/** The kinds of identifier that can point at a person. */
export const IDENTIFIER_TYPES = ["email", "visitor_id", "user_id", "device_id"] as const;
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

/** Which app first linked an identifier. */
export const IDENTIFIER_SOURCES = ["newsletter", "web", "mobile"] as const;
export type IdentifierSource = (typeof IDENTIFIER_SOURCES)[number];

/** One row per person. The ID is a random key that says nothing about them. */
export const people = peopleSchema.table("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per identifier. An identifier belongs to exactly one person. */
export const identifiers = peopleSchema.table(
  "identifiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    type: text("type", { enum: IDENTIFIER_TYPES }).notNull(),
    value: text("value").notNull(),
    source: text("source", { enum: IDENTIFIER_SOURCES }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("identifiers_type_value_key").on(table.type, table.value),
    index("identifiers_person_id_idx").on(table.personId),
  ],
);

/** A saved segment: a name and the rules that pick its people. */
export const segments = peopleSchema.table("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** The rules as JSON. Its shape is checked in apps/segments/definition.ts. */
  definition: jsonb("definition").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
