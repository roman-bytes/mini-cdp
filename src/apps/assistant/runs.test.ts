import { beforeAll, describe, expect, it } from "vitest";

import { findOrCreatePerson } from "@/apps/people/identifiers";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import { askAssistant } from "./run";
import { listRecentRuns, prepareTableForTeammate, summarisePrivacy, type ModelCall } from "./runs";
import { scriptedModel } from "./testing";

function call(overrides: Partial<ModelCall>): ModelCall {
  return {
    id: 1,
    runId: "r",
    step: 1,
    request: {},
    response: {},
    piiFindings: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe("summarisePrivacy", () => {
  it("counts the requests sent and any that were stopped", () => {
    expect(
      summarisePrivacy([
        call({ step: 1 }),
        call({ step: 2 }),
        call({ step: 3, response: null, piiFindings: ["email address"] }),
      ]),
    ).toEqual({ requestsSent: 2, requestsBlocked: 1, findings: ["email address"] });
  });
});

describe("with a database", () => {
  let db: Db;
  let julia: string;

  beforeAll(async () => {
    db = await createTestDb();
    julia = await findOrCreatePerson(db, "email", "julia.evans230@gmail.com", "newsletter");
  });

  describe("prepareTableForTeammate", () => {
    it("shows the person's email where the AI only had their key", async () => {
      const table = await prepareTableForTeammate(db, {
        kind: "table",
        title: "People",
        columns: ["person_key", "visits"],
        rows: [[julia, 3], [null, 1], ["00000000-0000-4000-8000-000000000000", 2]],
        totalRows: 3,
      });

      expect(table.columns).toEqual(["person", "visits"]);
      expect(table.rows).toEqual([
        ["julia.evans230@gmail.com", 3],
        ["Anonymous", 1],
        ["No email on file", 2],
      ]);
      expect(table.personIds).toEqual([julia, null, "00000000-0000-4000-8000-000000000000"]);
    });

    it("leaves a table about something other than people alone", async () => {
      const table = await prepareTableForTeammate(db, {
        kind: "table",
        title: "Pages",
        columns: ["page", "visits"],
        rows: [["/", 279]],
        totalRows: 1,
      });

      expect(table).toEqual({ title: "Pages", columns: ["page", "visits"], rows: [["/", 279]], totalRows: 1, kind: "table", personIds: [null] });
    });
  });

  describe("listRecentRuns", () => {
    it("lists questions newest first", async () => {
      for (const question of ["First question", "Second question"]) {
        await askAssistant(db, question, { provider: scriptedModel([{ text: "An answer." }]).provider, today: "2026-09-28" });
      }

      const recent = await listRecentRuns(db, 2);
      expect(recent.map((run) => run.question)).toEqual(["Second question", "First question"]);
    });
  });
});
