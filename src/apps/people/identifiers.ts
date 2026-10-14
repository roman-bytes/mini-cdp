import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { chunk, unique } from "@/shared/collections";
import { INSERT_BATCH_SIZE, insertInChunks } from "@/shared/db/bulk";
import type { Db } from "@/shared/db/client";
import { normalizeEmail } from "@/shared/email";

import { identifiers, people, type IdentifierSource, type IdentifierType } from "./schema";

/**
 * People's public functions. Other apps call these to find, create and link
 * people; they never read or write the people tables themselves.
 */

/** An identifier to point at a person. */
export type IdentifierLink = {
  personId: string;
  type: IdentifierType;
  value: string;
};

/** Identifier value -> the ID of the person it belongs to. */
export type PersonIdByValue = Map<string, string>;

/**
 * The stored form of an identifier. Emails are trimmed and lowercased; other
 * IDs are only trimmed. Results from this module are keyed by this form.
 */
export function normalizeIdentifier(type: IdentifierType, value: string): string {
  return type === "email" ? normalizeEmail(value) : value.trim();
}

function normalizeAll(type: IdentifierType, values: string[]): string[] {
  return unique(values.map((value) => normalizeIdentifier(type, value)));
}

/** Finds who each identifier belongs to. Values nobody owns are left out. */
export async function findPeopleByIdentifiers(
  db: Db,
  type: IdentifierType,
  values: string[],
): Promise<PersonIdByValue> {
  const found: PersonIdByValue = new Map();
  for (const batch of chunk(normalizeAll(type, values), INSERT_BATCH_SIZE)) {
    const rows = await db
      .select({ value: identifiers.value, personId: identifiers.personId })
      .from(identifiers)
      .where(and(eq(identifiers.type, type), inArray(identifiers.value, batch)));
    for (const row of rows) found.set(row.value, row.personId);
  }
  return found;
}

/**
 * Points identifiers at people. An identifier that already belongs to someone
 * is left with its current owner.
 */
export async function linkIdentifiers(
  db: Db,
  links: IdentifierLink[],
  source: IdentifierSource,
): Promise<void> {
  const rows = links.map((link) => ({
    personId: link.personId,
    type: link.type,
    value: normalizeIdentifier(link.type, link.value),
    source,
  }));
  for (const batch of chunk(rows, INSERT_BATCH_SIZE)) {
    await db
      .insert(identifiers)
      .values(batch)
      .onConflictDoNothing({ target: [identifiers.type, identifiers.value] });
  }
}

/** Creates one new person per value and links the value to them. */
async function createPeopleForIdentifiers(
  db: Db,
  type: IdentifierType,
  values: string[],
  source: IdentifierSource,
): Promise<PersonIdByValue> {
  const created: PersonIdByValue = new Map(
    values.map((value) => [value, randomUUID()]),
  );
  await insertInChunks(
    db,
    people,
    [...created.values()].map((id) => ({ id })),
  );
  await linkIdentifiers(
    db,
    [...created].map(([value, personId]) => ({ personId, type, value })),
    source,
  );
  return created;
}

/**
 * Finds the person behind each identifier, creating a person for any value
 * that has not been seen before. Every value gets an entry in the result.
 */
export async function findOrCreatePeopleByIdentifiers(
  db: Db,
  type: IdentifierType,
  values: string[],
  source: IdentifierSource,
): Promise<PersonIdByValue> {
  const known = await findPeopleByIdentifiers(db, type, values);
  const unseen = normalizeAll(type, values).filter((value) => !known.has(value));
  const created = await createPeopleForIdentifiers(db, type, unseen, source);
  return new Map([...known, ...created]);
}

/** Finds the person one identifier belongs to, or null if nobody owns it. */
export async function findPersonByIdentifier(
  db: Db,
  type: IdentifierType,
  value: string,
): Promise<string | null> {
  const found = await findPeopleByIdentifiers(db, type, [value]);
  return found.get(normalizeIdentifier(type, value)) ?? null;
}

/** Finds the person behind one identifier, creating them if they are new. */
export async function findOrCreatePerson(
  db: Db,
  type: IdentifierType,
  value: string,
  source: IdentifierSource,
): Promise<string> {
  const found = await findOrCreatePeopleByIdentifiers(db, type, [value], source);
  return found.get(normalizeIdentifier(type, value))!;
}
