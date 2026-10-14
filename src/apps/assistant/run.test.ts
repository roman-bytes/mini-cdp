import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { readImportFiles } from "@/apps/imports/read-files";
import { runImport } from "@/apps/imports/run-import";
import { findPersonByIdentifier } from "@/apps/people/identifiers";
import { identifiers } from "@/apps/people/schema";
import { countSegment } from "@/apps/segments/run";
import { getSegment, saveSegment } from "@/apps/segments/saved";
import type { Db } from "@/shared/db/client";
import { createTestDb } from "@/shared/db/testing";

import type { GenerateContentParameters } from "@google/genai";
import { findPii } from "./pii";
import { MAX_MODEL_CALLS, askAssistant } from "./run";
import { getRun } from "./runs";
import type { AssistantSegment, AssistantTable } from "./schema";
import { scriptedModel, type ScriptedReply } from "./testing";

const TODAY = "2026-09-28";

/**
 * The privacy tests for the assistant. A scripted model plays the AI's part
 * (deciding which tools to call), while everything else runs for real against
 * the assessment data: scrubbing, the SQL as ai_reader, segments, auditing.
 * Each test then checks every request that would have gone to the AI.
 */
describe("askAssistant, with the assessment files loaded", () => {
  let db: Db;
  let allEmails: string[];

  beforeAll(async () => {
    db = await createTestDb();
    await runImport(db, await readImportFiles("data"));
    const rows = await db.select({ value: identifiers.value }).from(identifiers).where(eq(identifiers.type, "email"));
    allEmails = rows.map((row) => row.value);
  }, 120_000);

  async function ask(question: string, replies: ScriptedReply[]) {
    const scripted = scriptedModel(replies);
    const runId = await askAssistant(db, question, { provider: scripted.provider, today: TODAY });
    const record = (await getRun(db, runId))!;
    return { ...record, requests: scripted.requests };
  }

  /** The proof: nothing sent to the AI contains an email, a raw ID, or any real subscriber's email. */
  function expectNothingIdentifying(requests: GenerateContentParameters[]) {
    for (const request of requests) {
      const sent = JSON.stringify(request).toLowerCase();
      expect(findPii(sent)).toEqual([]);
      expect(allEmails.some((email) => sent.includes(email))).toBe(false);
    }
  }

  it("answers 'how many Instagram signups went cold last month?' with the right number", async () => {
    const { run, requests } = await ask("How many Instagram signups went cold last month?", [
      {
        tool: "run_query",
        input: {
          title: "Instagram signups in August 2026",
          sql: `select count(*)::int as signups,
                       count(*) filter (where last_open_date is null or last_open_date < date '2026-09-28' - 30)::int as went_cold
                from people
                where acquisition_source = 'instagram' and signup_date between '2026-08-01' and '2026-08-31'`,
        },
      },
      { text: "76 of the 281 people who signed up from Instagram in August have not opened an email in the last 30 days." },
    ]);

    expect(run.status).toBe("answered");
    expect(run.answer).toMatch(/^76 of the 281/);
    expect(run.outputs[0]).toMatchObject({ kind: "table", columns: ["signups", "went_cold"], rows: [[281, 76]] });
    expectNothingIdentifying(requests);
  });

  it("answers 'build me a list of our most engaged readers' with a saved segment", async () => {
    const { run, requests } = await ask("Build me a list of our most engaged readers", [
      {
        tool: "create_segment",
        input: {
          name: "Most engaged readers",
          match: "all",
          rules: [
            { field: "last_open", op: "within_days", value: "7" },
            { field: "web_visits", op: "at_least", value: "5" },
          ],
        },
      },
      { text: "I saved a segment of readers who opened an email in the last 7 days and visited the site at least 5 times." },
    ]);

    const segment = run.outputs[0] as AssistantSegment;
    const saved = (await getSegment(db, segment.segmentId))!;
    expect(run.status).toBe("answered");
    expect(segment).toMatchObject({ kind: "segment", name: "Most engaged readers" });
    expect(segment.total).toBe((await countSegment(db, saved.definition, TODAY)).total);
    expect(segment.total).toBeGreaterThan(0);
    expectNothingIdentifying(requests);
  });

  it("answers 'which pages do new subscribers hit first?' with a table", async () => {
    const { run, requests } = await ask("Which pages do new subscribers hit first?", [
      {
        tool: "run_query",
        input: {
          title: "First page seen by each subscriber",
          sql: `select page, count(*)::int as subscribers
                from (select distinct on (person_key) person_key, page
                      from web_visits where person_key is not null
                      order by person_key, occurred_at) as first_visits
                group by page order by subscribers desc, page`,
        },
      },
      { text: "Most subscribers first land on the home page, followed by the subscribe page." },
    ]);

    const table = run.outputs[0] as AssistantTable;
    expect(table.rows.slice(0, 4)).toEqual([
      ["/", 279],
      ["/subscribe", 256],
      ["/shadrachs-picks", 124],
      ["/about", 112],
    ]);
    expectNothingIdentifying(requests);
  });

  it("lists people by key for the AI, never by email", async () => {
    const { run, requests } = await ask("Who are our newest Instagram subscribers?", [
      {
        tool: "run_query",
        input: {
          title: "Newest Instagram subscribers",
          sql: "select person_key, signup_date from people where acquisition_source = 'instagram' order by signup_date desc, person_key limit 10",
        },
      },
      { text: "Here are the ten newest Instagram subscribers." },
    ]);

    expect((run.outputs[0] as AssistantTable).rows).toHaveLength(10);
    expect(JSON.stringify(requests.at(-1))).toContain("person_key");
    expectNothingIdentifying(requests);
  });

  it("swaps an email in the question for the person's key before sending", async () => {
    const julia = await findPersonByIdentifier(db, "email", "julia.evans230@gmail.com");
    const { run, requests } = await ask("Is julia.evans230@gmail.com still opening our emails?", [
      { tool: "run_query", input: { title: "Last open", sql: `select last_open_date from people where person_key = '${julia}'` } },
      { text: "Yes, they last opened an email on September 15, 2026." },
    ]);

    expect(run.question).toBe("Is julia.evans230@gmail.com still opening our emails?");
    expect(run.sentQuestion).toBe(`Is [person ${julia}] still opening our emails?`);
    expect(run.outputs[0]).toMatchObject({ rows: [["2026-09-15"]] });
    expectNothingIdentifying(requests);
  });

  it("returns a permission error when the AI tries to read emails, and carries on", async () => {
    const { run, requests } = await ask("List everyone's email", [
      { tool: "run_query", input: { title: "Emails", sql: "select value from people.identifiers" } },
      { text: "I can't see email addresses. I can list people by key instead, and the app will show you who they are." },
    ]);

    const toolResult = JSON.stringify((requests[1].contents as unknown[]).at(-1));
    expect(toolResult).toContain("permission denied");
    expect(toolResult).toContain('"error"');
    expect(run.status).toBe("answered");
    expectNothingIdentifying(requests);
  });

  it("stops before sending anything identifying, even if a tool result carried it", async () => {
    await saveSegment(db, "Ask lisa.helper@example.com about these", { match: "all", rules: [] });

    const { run, calls, requests } = await ask("What segments do we have?", [
      { tool: "run_query", input: { title: "Saved segments", sql: "select name from segments" } },
      { text: "This reply must never be requested." },
    ]);

    expect(run.status).toBe("blocked");
    expect(run.error).toMatch(/email address/);
    expect(requests).toHaveLength(1);
    expect(calls.at(-1)).toMatchObject({ response: null, piiFindings: ["email address"] });
  });

  it("records every request exactly as sent", async () => {
    const { calls, requests } = await ask("How many subscribers do we have?", [
      { tool: "run_query", input: { title: "Subscribers", sql: "select count(*)::int as subscribers from people where kind = 'subscriber'" } },
      { text: "We have 2,900 subscribers." },
    ]);

    expect(calls.map((call) => call.request)).toEqual(requests);
    expect(calls.every((call) => call.piiFindings.length === 0)).toBe(true);
  });

  it("records a failure when the AI cannot be reached", async () => {
    const { run } = await ask("How many subscribers do we have?", [{ error: new Error("network down") }]);

    expect(run).toMatchObject({ status: "failed", error: "network down" });
  });

  it("records a refusal", async () => {
    const { run } = await ask("How many subscribers do we have?", [{ refusal: true }]);

    expect(run).toMatchObject({ status: "failed", error: "The AI declined to answer this question." });
  });

  it("gives up after too many steps", async () => {
    const loop: ScriptedReply = { tool: "run_query", input: { title: "Again", sql: "select 1 as one" } };
    const { run, requests } = await ask("Keep going", Array.from({ length: MAX_MODEL_CALLS }, () => loop));

    expect(requests).toHaveLength(MAX_MODEL_CALLS);
    expect(run.status).toBe("failed");
  });
});
