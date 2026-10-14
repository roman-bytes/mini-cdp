import {
  findOrCreatePeopleByIdentifiers,
  findPeopleByIdentifiers,
  linkIdentifiers,
  type PersonIdByValue,
} from "@/apps/people/identifiers";
import { unique } from "@/shared/collections";
import { insertInChunks } from "@/shared/db/bulk";
import type { Db } from "@/shared/db/client";
import { fileLineNumber, loaded, setAside, type RowResult } from "@/shared/raw/outcomes";
import { replaceRawRows } from "@/shared/raw/replace-rows";

import { rawWebEvents, visits } from "./schema";
import {
  cleanWebEventRow,
  firstEmailByVisitor,
  type CleanVisit,
  type RawWebEventRow,
} from "./web-event-rows";

/** What the importer decided for one source row. */
type PlannedRow = {
  result: RowResult;
  /** The visitor the row belongs to, when the row was usable. */
  visitorId: string | null;
};

export type WebEventImportPlan = {
  /** Every usable page view. */
  visits: CleanVisit[];
  /** One entry per source row, in file order. */
  rows: PlannedRow[];
};

/** Decides what happens to every row, without touching the database. */
export function planWebEventImport(rows: RawWebEventRow[]): WebEventImportPlan {
  const cleanVisits: CleanVisit[] = [];

  const planned = rows.map((row): PlannedRow => {
    const check = cleanWebEventRow(row);
    if (!check.ok) return { result: setAside(check.reason), visitorId: null };

    cleanVisits.push(check.visit);
    return { result: loaded(), visitorId: check.visit.visitorId };
  });

  return { visits: cleanVisits, rows: planned };
}

/**
 * Tells People which visitor IDs belong to which person. A visitor ID belongs
 * to the person whose email it gave; that person is created if they are new.
 */
async function linkVisitorsToPeople(db: Db, cleanVisits: CleanVisit[]): Promise<void> {
  const emailByVisitor = firstEmailByVisitor(cleanVisits);
  const personByEmail = await findOrCreatePeopleByIdentifiers(
    db,
    "email",
    [...emailByVisitor.values()],
    "web",
  );
  const links = [...emailByVisitor].map(([visitorId, email]) => ({
    personId: personByEmail.get(email)!,
    type: "visitor_id" as const,
    value: visitorId,
  }));
  await linkIdentifiers(db, links, "web");
}

/** Replaces the stored visits. Each one gets its visitor's person, if any. */
async function saveVisits(
  db: Db,
  cleanVisits: CleanVisit[],
  personByVisitor: PersonIdByValue,
): Promise<void> {
  const rows = cleanVisits.map((visit) => ({
    visitorId: visit.visitorId,
    personId: personByVisitor.get(visit.visitorId) ?? null,
    page: visit.page,
    occurredAt: visit.occurredAt,
    utmSource: visit.utmSource,
  }));
  await db.delete(visits);
  await insertInChunks(db, visits, rows);
}

function toRawRows(
  rows: RawWebEventRow[],
  plan: WebEventImportPlan,
  personByVisitor: PersonIdByValue,
) {
  return rows.map((row, index) => {
    const { result, visitorId } = plan.rows[index];
    return {
      rowNumber: fileLineNumber(index),
      outcome: result.outcome,
      reason: result.reason,
      personId: visitorId ? (personByVisitor.get(visitorId) ?? null) : null,
      visitorId: row.visitor_id,
      page: row.page,
      timestamp: row.timestamp,
      utmSource: row.utm_source,
      email: row.email,
    };
  });
}

/**
 * Loads web_events.csv. Only some rows carry an email, so identity is decided
 * per visitor, not per row: once a visitor ID is linked to a person, every
 * visit from that visitor attaches to them, before and after the signup.
 * Visitors who never gave an email keep their visits, unattached.
 */
export async function importWebEvents(db: Db, rows: RawWebEventRow[]): Promise<void> {
  const plan = planWebEventImport(rows);
  await linkVisitorsToPeople(db, plan.visits);

  const visitorIds = unique(plan.visits.map((visit) => visit.visitorId));
  const personByVisitor = await findPeopleByIdentifiers(db, "visitor_id", visitorIds);

  await saveVisits(db, plan.visits, personByVisitor);
  await replaceRawRows(db, rawWebEvents, toRawRows(rows, plan, personByVisitor));
}
