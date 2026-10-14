import { eq } from "drizzle-orm";

import type { Db } from "@/shared/db/client";

import type { ChatTurn, ModelProvider, SentRequest, ToolResult } from "./conversation";
import { findPii, scrubQuestion } from "./pii";
import { buildSystemPrompt } from "./prompt";
import { modelCalls, runs, type AssistantOutput, type RunStatus } from "./schema";
import { ASSISTANT_TOOLS, executeTool } from "./tools";

/** The most requests one question may take: a few queries and the answer. */
export const MAX_MODEL_CALLS = 8;

type Finish = { status: RunStatus; answer?: string; error?: string; outputs: AssistantOutput[] };

async function finishRun(db: Db, runId: string, finish: Finish): Promise<string> {
  await db
    .update(runs)
    .set({
      status: finish.status,
      answer: finish.answer ?? null,
      error: finish.error ?? null,
      outputs: finish.outputs,
      finishedAt: new Date(),
    })
    .where(eq(runs.id, runId));
  return runId;
}

async function recordCall(
  db: Db,
  runId: string,
  step: number,
  request: Record<string, unknown>,
  response: unknown,
  piiFindings: string[],
): Promise<void> {
  await db.insert(modelCalls).values({ runId, step, request, response: response ?? null, piiFindings });
}

/**
 * Answers one question. The steps, each recorded for "What the AI saw":
 * 1. swap any email or raw ID in the question for an opaque reference;
 * 2. send the question with the PII-free schema and two tools;
 * 3. before every request, scan the whole payload and refuse to send it if
 *    anything identifying is in it;
 * 4. run the tools the model asks for (read-only SQL as ai_reader, or saving
 *    a segment) and send back only what those return;
 * 5. stop when the model answers in words.
 * Returns the run's ID.
 */
export async function askAssistant(
  db: Db,
  question: string,
  options: { provider: ModelProvider; today: string },
): Promise<string> {
  const { provider, today } = options;
  const scrubbed = await scrubQuestion(db, question);
  const [run] = await db
    .insert(runs)
    .values({ question, sentQuestion: scrubbed.text, replacements: scrubbed.replacements, status: "running" })
    .returning({ id: runs.id });

  const system = buildSystemPrompt(today);
  const turns: ChatTurn[] = [{ role: "user", text: scrubbed.text }];
  const outputs: AssistantOutput[] = [];

  for (let step = 1; step <= MAX_MODEL_CALLS; step += 1) {
    const request = provider.buildRequest({ system, turns, tools: ASSISTANT_TOOLS });

    const findings = findPii(JSON.stringify(request));
    if (findings.length > 0) {
      await recordCall(db, run.id, step, request, null, findings);
      return finishRun(db, run.id, {
        status: "blocked",
        error: `Stopped before sending: the request to the AI contained an ${findings.join(" and an ")}.`,
        outputs,
      });
    }

    let result: SentRequest;
    try {
      result = await provider.send(request);
    } catch (error) {
      await recordCall(db, run.id, step, request, null, []);
      return finishRun(db, run.id, { status: "failed", error: provider.describeError(error), outputs });
    }
    await recordCall(db, run.id, step, result.sent, result.raw, []);

    const { reply } = result;
    if (reply.refused) {
      return finishRun(db, run.id, { status: "failed", error: "The AI declined to answer this question.", outputs });
    }
    if (reply.toolCalls.length === 0) {
      return finishRun(db, run.id, { status: "answered", answer: reply.text, outputs });
    }

    turns.push({ role: "model", providerContent: reply.providerContent });
    const results: ToolResult[] = [];
    for (const call of reply.toolCalls) {
      const outcome = await executeTool(db, call, today);
      results.push({ callId: call.id, name: call.name, content: outcome.content, isError: outcome.isError });
      if (outcome.output) outputs.push(outcome.output);
    }
    turns.push({ role: "tool", results });
  }

  return finishRun(db, run.id, {
    status: "failed",
    error: "The assistant took too many steps without finishing. Try asking a narrower question.",
    outputs,
  });
}
