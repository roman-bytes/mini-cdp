import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

import type { ModelProvider } from "./conversation";
import { createGeminiProvider } from "./gemini";

/** One reply a scripted model gives, in order. */
export type ScriptedReply =
  | { tool: "run_query"; input: { title: string; sql: string } }
  | { tool: "create_segment"; input: { name: string; match: string; rules: { field: string; op: string; value: string }[] } }
  | { text: string }
  | { refusal: true }
  | { error: Error };

/** A reply in the shape Gemini sends, so the real response reader is exercised. */
function toGeminiResponse(reply: ScriptedReply): GenerateContentResponse {
  if ("error" in reply) throw reply.error;
  if ("refusal" in reply) {
    return { candidates: [{ content: { role: "model", parts: [] }, finishReason: "SAFETY" }] } as unknown as GenerateContentResponse;
  }
  const part = "tool" in reply
    ? { functionCall: { name: reply.tool, args: reply.input }, thoughtSignature: "scripted-signature" }
    : { text: reply.text };
  return {
    modelVersion: "scripted",
    candidates: [{ content: { role: "model", parts: [part] }, finishReason: "STOP" }],
  } as unknown as GenerateContentResponse;
}

/**
 * A stand-in for the AI. It is the real Gemini provider with the network
 * call replaced: requests are built exactly as they would be for Gemini and
 * kept for inspection, and fixed replies are played back in order.
 */
export function scriptedModel(replies: ScriptedReply[]): { provider: ModelProvider; requests: GenerateContentParameters[] } {
  const requests: GenerateContentParameters[] = [];
  const provider = createGeminiProvider({
    models: ["scripted-model"],
    generate: async (request) => {
      requests.push(JSON.parse(JSON.stringify(request)));
      const reply = replies[requests.length - 1];
      if (!reply) throw new Error("The scripted model ran out of replies.");
      return toGeminiResponse(reply);
    },
  });
  return { provider, requests };
}
