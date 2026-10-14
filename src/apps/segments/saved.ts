import { desc, eq } from "drizzle-orm";

import { segments } from "@/apps/people/schema";
import type { Db } from "@/shared/db/client";
import { isUuid } from "@/shared/ids";

import { checkDefinition, type SegmentDefinition } from "./definition";

/** A saved segment with its rules checked and ready to run. */
export type SavedSegment = {
  id: string;
  name: string;
  definition: SegmentDefinition;
  createdAt: Date;
};

type SegmentRow = typeof segments.$inferSelect;

/** Rules read back from the database are checked like any other input. */
function toSavedSegment(row: SegmentRow): SavedSegment | null {
  const check = checkDefinition(row.definition);
  if (!check.ok) return null;
  return { id: row.id, name: row.name, definition: check.definition, createdAt: row.createdAt };
}

function keepUsable(rows: SegmentRow[]): SavedSegment[] {
  return rows.map(toSavedSegment).filter((segment): segment is SavedSegment => segment !== null);
}

/** Saves a segment under a name and returns its ID. */
export async function saveSegment(db: Db, name: string, definition: SegmentDefinition): Promise<string> {
  const [row] = await db
    .insert(segments)
    .values({ name: name.trim(), definition })
    .returning({ id: segments.id });
  return row.id;
}

/** Every saved segment, newest first. */
export async function listSegments(db: Db): Promise<SavedSegment[]> {
  return keepUsable(await db.select().from(segments).orderBy(desc(segments.createdAt)));
}

/** One saved segment, or null when the ID matches nothing. */
export async function getSegment(db: Db, id: string): Promise<SavedSegment | null> {
  if (!isUuid(id)) return null;
  return keepUsable(await db.select().from(segments).where(eq(segments.id, id)))[0] ?? null;
}

export async function deleteSegment(db: Db, id: string): Promise<void> {
  if (!isUuid(id)) return;
  await db.delete(segments).where(eq(segments.id, id));
}
