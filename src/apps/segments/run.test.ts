import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import { ingestEvent } from "@/apps/mobile/ingest-event";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { DEFAULT_SORT, PEOPLE_PAGE_SIZE } from "@/apps/people/directory";
import type { PeopleParams } from "@/apps/people/people-params";

import { compileRule } from "./compile";
import type { SegmentDefinition, SegmentRule } from "./definition";
import { countSegment, listSegmentMembers, listSegmentPeople } from "./run";
import { deleteSegment, getSegment, listSegments, saveSegment } from "./saved";

const TODAY = "2026-09-28";

function all(...rules: SegmentRule[]): SegmentDefinition {
  return { match: "all", rules };
}

const INSTAGRAM = { field: "source", op: "is", value: "instagram" };
const NOT_OPENED_IN_30_DAYS = { field: "last_open", op: "not_within_days", value: 30 };

describe("segments, with the assessment files loaded", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    await runImport(db, await readImportFiles("data"));
  }, 120_000);

  async function total(definition: SegmentDefinition): Promise<number> {
    return (await countSegment(db, definition, TODAY)).total;
  }

  it("answers the brief's example: Instagram signups with no open in 30 days", async () => {
    const size = await countSegment(db, all(INSTAGRAM, NOT_OPENED_IN_30_DAYS), TODAY);

    expect(size).toEqual({ total: 229, neverOpened: 146 });
  });

  it("tags the people who never opened in the member list", async () => {
    const members = await listSegmentMembers(db, all(INSTAGRAM, NOT_OPENED_IN_30_DAYS), TODAY);

    expect(members).toHaveLength(229);
    expect(members.filter((member) => member.neverOpened)).toHaveLength(146);
    expect(members.every((member) => member.acquisitionSource === "instagram")).toBe(true);
  });

  describe("listSegmentPeople", () => {
    const table = (overrides: Partial<PeopleParams> = {}): PeopleParams => ({
      filters: {},
      sort: DEFAULT_SORT,
      page: 1,
      pageSize: PEOPLE_PAGE_SIZE,
      ...overrides,
    });
    const coldInstagram = all(INSTAGRAM, NOT_OPENED_IN_30_DAYS);

    it("lists only the segment's people, one page at a time", async () => {
      const page = await listSegmentPeople(db, coldInstagram, TODAY, table());

      expect(page.total).toBe(229);
      expect(page.people).toHaveLength(PEOPLE_PAGE_SIZE);
      expect(page.people.every((person) => person.acquisitionSource === "instagram")).toBe(true);
    });

    it("narrows within the segment with the table's filters", async () => {
      const neverOpened = await listSegmentPeople(db, coldInstagram, TODAY, table({ filters: { engagement: "never" } }));
      const active = await listSegmentPeople(db, coldInstagram, TODAY, table({ filters: { status: "active" } }));

      expect(neverOpened.total).toBe(146);
      expect(active.total).toBe(174);
    });

    it("searches only inside the segment", async () => {
      const outside = await listSegmentPeople(db, coldInstagram, TODAY, table({ filters: { query: "julia.evans230" } }));

      expect(outside.total).toBe(0);
    });

    it("sorts the segment's people", async () => {
      const page = await listSegmentPeople(db, coldInstagram, TODAY, table({ sort: { column: "signup_date", direction: "desc" } }));

      expect(page.people[0].signupDate! >= page.people.at(-1)!.signupDate!).toBe(true);
    });
  });

  it("covers all statuses by default, and narrows when a status rule is added", async () => {
    expect(await total(all(INSTAGRAM))).toBe(899);
    expect(await total(all(INSTAGRAM, { field: "status", op: "is", value: "active" }))).toBe(806);
    expect(
      await total(all(INSTAGRAM, NOT_OPENED_IN_30_DAYS, { field: "status", op: "is", value: "active" })),
    ).toBe(174);
  });

  it("matches everyone when there are no rules", async () => {
    expect(await total(all())).toBe(2930);
  });

  it("joins rules with OR when the segment matches any", async () => {
    const either: SegmentDefinition = {
      match: "any",
      rules: [INSTAGRAM, { field: "source", op: "is", value: "x" }],
    };

    expect(await total(either)).toBe(899 + 114);
  });

  it("splits people cleanly on each side of a yes/no rule", async () => {
    const withApp = await total(all({ field: "app_account", op: "has" }));
    const withoutApp = await total(all({ field: "app_account", op: "has_not" }));

    expect(withApp).toBe(930);
    expect(withApp + withoutApp).toBe(2930);
  });

  it("only counts subscribers for email-open rules", async () => {
    expect(await total(all({ field: "last_open", op: "never" }))).toBe(470);
    expect(await total(all({ field: "kind", op: "is", value: "app_only" }))).toBe(30);
    expect(
      await total(all({ field: "kind", op: "is", value: "app_only" }, { field: "last_open", op: "never" })),
    ).toBe(0);
  });

  it("filters on signup date and on web activity", async () => {
    const august = all(
      INSTAGRAM,
      { field: "signup_date", op: "on_or_after", value: "2026-08-01" },
      { field: "signup_date", op: "on_or_before", value: "2026-08-31" },
    );

    expect(await total(august)).toBe(281);
    expect(await total(all({ field: "web_visits", op: "at_least", value: 1 }))).toBe(1400);
    expect(await total(all({ field: "viewed_page", op: "viewed", value: "/subscribe" }))).toBe(1400);
  });

  it("treats 'is not' as including people with no value", async () => {
    const notInstagram = await total(all({ field: "source", op: "is_not", value: "instagram" }));

    expect(notInstagram).toBe(2930 - 899);
  });

  it("changes as soon as a new app event arrives", async () => {
    const readers = all({ field: "app_event", op: "did", value: "read_story" });
    expect(await total(readers)).toBe(0);

    await ingestEvent(db, {
      id: "evt_segment_test",
      event: "read_story",
      userId: "u_2b6447a3",
      deviceId: "d_segment_test",
      occurredAt: new Date("2026-09-28T14:22:05Z"),
      properties: { story: "supreme-court-ruling-explained" },
    });

    expect(await total(readers)).toBe(1);
  });

  it("refuses to build SQL for a field it does not know", () => {
    expect(() => compileRule({ field: "email", op: "is", value: "x" }, TODAY)).toThrow(/No SQL/);
  });

  describe("saved segments", () => {
    it("saves, lists, reads and deletes a segment", async () => {
      const definition = all(INSTAGRAM, NOT_OPENED_IN_30_DAYS);
      const id = await saveSegment(db, "  Cold Instagram  ", definition);

      expect(await getSegment(db, id)).toMatchObject({ id, name: "Cold Instagram", definition });
      expect((await listSegments(db)).map((segment) => segment.id)).toContain(id);

      await deleteSegment(db, id);
      expect(await getSegment(db, id)).toBeNull();
    });

    it("returns null for an unknown or malformed ID", async () => {
      expect(await getSegment(db, "not-a-uuid")).toBeNull();
      expect(await getSegment(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    });
  });
});
