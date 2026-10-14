import type { Db } from "@/shared/db/client";

import { findMatchedIdentifiers, searchPeople } from "./directory";
import type { PersonKind } from "./profiles-view";

/** Fewer characters than this match too many people to be useful. */
export const QUICK_FIND_MIN_LENGTH = 2;
export const QUICK_FIND_LIMIT = 8;

/** One match in the global search box. */
export type QuickFindResult = {
  personId: string;
  email: string | null;
  kind: PersonKind;
  /** The identifier that matched, when it was not the email (e.g. a user ID). */
  matched: { type: string; value: string } | null;
};

/** The first few people whose email or ID contains the text, for the search box in the top bar. */
export async function quickFind(db: Db, query: string, limit = QUICK_FIND_LIMIT): Promise<QuickFindResult[]> {
  const term = query.trim();
  if (term.length < QUICK_FIND_MIN_LENGTH) return [];

  const page = await searchPeople(db, { query: term, pageSize: limit });
  const matched = await findMatchedIdentifiers(db, page.people.map((person) => person.personId), term);

  return page.people.map((person) => {
    const match = matched.get(person.personId);
    return {
      personId: person.personId,
      email: person.email,
      kind: person.kind,
      matched: match && match.type !== "email" ? match : null,
    };
  });
}
