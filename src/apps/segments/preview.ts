import type { Db } from "@/shared/db/client";

import { checkDefinition } from "./definition";
import { countSegment, type SegmentSize } from "./run";
import { saveSegment } from "./saved";

export type SegmentPreview = { ok: true; size: SegmentSize } | { ok: false; errors: string[] };

/** Checks rules from the builder and, when they are valid, counts the people they pick. */
export async function previewSegment(db: Db, input: unknown, today: string): Promise<SegmentPreview> {
  const check = checkDefinition(input);
  if (!check.ok) return check;
  return { ok: true, size: await countSegment(db, check.definition, today) };
}

export type SaveResult = { ok: true; id: string } | { ok: false; errors: string[] };

/** Checks a name and rules from the builder and saves them as a segment. */
export async function saveCheckedSegment(db: Db, name: string, input: unknown): Promise<SaveResult> {
  if (name.trim() === "") return { ok: false, errors: ["Give the segment a name"] };

  const check = checkDefinition(input);
  if (!check.ok) return check;

  return { ok: true, id: await saveSegment(db, name, check.definition) };
}
