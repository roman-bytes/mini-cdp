import { findPersonByIdentifier } from "@/apps/people/identifiers";
import type { IdentifierType } from "@/apps/people/schema";
import type { Db } from "@/shared/db/client";

import type { Replacement } from "./schema";

/** Patterns for anything that could identify a person. */
export const PII_PATTERNS: { kind: string; identifier: IdentifierType; pattern: RegExp }[] = [
  { kind: "email address", identifier: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: "app user ID", identifier: "user_id", pattern: /\bu_[0-9a-f]{8}\b/gi },
  { kind: "web visitor ID", identifier: "visitor_id", pattern: /\bv_[0-9a-f]{10}\b/gi },
  { kind: "app device ID", identifier: "device_id", pattern: /\bd_[0-9a-f]{6}\b/gi },
];

/** Each kind of identifying text found in `text`, e.g. ["email address"]. Empty means none. */
export function findPii(text: string): string[] {
  return PII_PATTERNS.filter(({ pattern }) => text.match(pattern) !== null).map(({ kind }) => kind);
}

/** The text a person is replaced with in the question: their opaque key. */
export function personReference(personId: string | null): string {
  return personId ? `[person ${personId}]` : "[someone not in the data]";
}

/**
 * Swaps every email or raw ID in a teammate's question for an opaque
 * reference before the question goes anywhere near the model. A match is
 * looked up in People, so the model can still ask about that person by key.
 */
export async function scrubQuestion(
  db: Db,
  question: string,
): Promise<{ text: string; replacements: Replacement[] }> {
  let text = question;
  const replacements: Replacement[] = [];

  for (const { identifier, pattern } of PII_PATTERNS) {
    for (const original of new Set(question.match(pattern) ?? [])) {
      const replacement = personReference(await findPersonByIdentifier(db, identifier, original));
      text = text.split(original).join(replacement);
      replacements.push({ original, replacement });
    }
  }

  return { text, replacements };
}
