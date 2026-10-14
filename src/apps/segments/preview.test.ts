import { beforeAll, describe, expect, it } from "vitest";

import { importSubscribers } from "@/apps/newsletter/import-subscribers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { PREVIEW_MEMBER_LIMIT, previewSegment, saveCheckedSegment } from "./preview";
import { getSegment } from "./saved";

const TODAY = "2026-09-28";
const INSTAGRAM = { match: "all", rules: [{ field: "source", op: "is", value: "instagram" }] };

describe("the segment builder's server side", () => {
  let db: Db;

  beforeAll(async () => {
    db = await createTestDb();
    const rows = Array.from({ length: 40 }, (_, index) => ({
      email: `person${String(index).padStart(2, "0")}@example.com`,
      signup_date: "2026-08-01",
      status: "active",
      acquisition_source: index < 30 ? "Instagram" : "Google",
      last_open_date: index < 10 ? "" : "2026-09-20",
    }));
    await importSubscribers(db, rows);
  });

  it("previews with an exact count and a capped list of people", async () => {
    const preview = await previewSegment(db, INSTAGRAM, TODAY);

    expect(preview).toMatchObject({ ok: true, size: { total: 30, neverOpened: 10 } });
    if (preview.ok) {
      expect(preview.members).toHaveLength(PREVIEW_MEMBER_LIMIT);
      expect(preview.members[0]).toMatchObject({ email: "person00@example.com", neverOpened: true });
    }
  });

  it("returns the problems instead of running bad rules", async () => {
    const preview = await previewSegment(db, { match: "all", rules: [{ field: "email", op: "is" }] }, TODAY);

    expect(preview).toEqual({ ok: false, errors: ['Unknown field "email"'] });
  });

  it("saves a named, valid segment", async () => {
    const result = await saveCheckedSegment(db, "Instagram signups", INSTAGRAM);

    expect(result.ok).toBe(true);
    if (result.ok) expect(await getSegment(db, result.id)).toMatchObject({ name: "Instagram signups" });
  });

  it("refuses a segment with no name", async () => {
    expect(await saveCheckedSegment(db, "  ", INSTAGRAM)).toEqual({
      ok: false,
      errors: ["Give the segment a name"],
    });
  });

  it("refuses to save bad rules", async () => {
    const result = await saveCheckedSegment(db, "Broken", { match: "all", rules: [{ field: "nope", op: "is" }] });

    expect(result).toEqual({ ok: false, errors: ['Unknown field "nope"'] });
  });
});
