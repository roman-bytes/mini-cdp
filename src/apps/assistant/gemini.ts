import {
  ApiError,
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";

import type { ChatTurn, ModelProvider, ModelReply, SentRequest, ToolCall, ToolSpec } from "./conversation";

/**
 * The only file that knows the assistant runs on Google's Gemini API.
 * Everything else uses the provider-neutral types in conversation.ts.
 */

/**
 * Free-tier models to try, in order. The first is the stronger model; when
 * it is out of free quota or too busy, the run moves to the next one.
 * Override with GEMINI_MODEL (comma-separated) in .env.local.
 */
export const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];

export function geminiModels(setting: string | undefined = process.env.GEMINI_MODEL): string[] {
  const models = (setting ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter((model) => model !== "");
  return models.length > 0 ? models : DEFAULT_GEMINI_MODELS;
}

/** Turns a tool result's JSON text into the object Gemini expects as a function response. */
function responseObject(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { result: parsed };
  } catch {
    return { result: content };
  }
}

/** The conversation in Gemini's format. A model turn goes back exactly as it came. */
export function toGeminiContents(turns: ChatTurn[]): Content[] {
  return turns.map((turn): Content => {
    if (turn.role === "user") return { role: "user", parts: [{ text: turn.text }] };
    if (turn.role === "model") return turn.providerContent as Content;
    return {
      role: "user",
      parts: turn.results.map((result) => ({
        functionResponse: {
          ...(result.callId ? { id: result.callId } : {}),
          name: result.name,
          response: responseObject(result.content),
        },
      })),
    };
  });
}

/** The full request for one step of a conversation. */
export function buildGeminiRequest(
  model: string,
  input: { system: string; turns: ChatTurn[]; tools: ToolSpec[] },
): GenerateContentParameters {
  return {
    model,
    contents: toGeminiContents(input.turns),
    config: {
      systemInstruction: input.system,
      tools: [
        {
          functionDeclarations: input.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parametersJsonSchema: tool.parameters,
          })),
        },
      ],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
    },
  };
}

/** Finish reasons that mean Gemini declined rather than answered. */
const DECLINED = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "OTHER"]);

/** Reads the text, the tool calls and any refusal out of a Gemini response. */
export function readGeminiResponse(response: Pick<GenerateContentResponse, "candidates" | "promptFeedback">): ModelReply {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  const toolCalls: ToolCall[] = parts
    .filter((part) => part.functionCall?.name)
    .map((part) => ({
      ...(part.functionCall!.id ? { id: part.functionCall!.id } : {}),
      name: part.functionCall!.name!,
      input: part.functionCall!.args ?? {},
    }));
  const text = parts
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();

  const blocked = Boolean(response.promptFeedback?.blockReason);
  const declined = DECLINED.has(String(candidate?.finishReason)) && text === "" && toolCalls.length === 0;

  return {
    text,
    toolCalls,
    refused: !candidate || blocked || declined,
    providerContent: candidate?.content ?? { role: "model", parts: [] },
  };
}

/** The parts of a response worth keeping in the audit record (no HTTP headers). */
export function plainResponse(response: GenerateContentResponse): Record<string, unknown> {
  return {
    modelVersion: response.modelVersion,
    candidates: response.candidates,
    promptFeedback: response.promptFeedback,
    usageMetadata: response.usageMetadata,
  };
}

/** True when the request failed because a free-tier quota ran out. */
export function isQuotaError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

/** Server-side errors that usually pass, such as 503 "high demand". */
export const RETRYABLE_STATUS_CODES = [500, 502, 503, 504];

/** True when Gemini could not take the request right now (overloaded or briefly down). */
export function isUnavailableError(error: unknown): boolean {
  return error instanceof ApiError && RETRYABLE_STATUS_CODES.includes(error.status);
}

/** Worth trying the next model: this one is out of free quota, or too busy even after retries. */
export function shouldTryNextModel(error: unknown): boolean {
  return isQuotaError(error) || isUnavailableError(error);
}

/**
 * The SDK retries a busy model a couple of times with a short back-off before
 * giving up. A used-up quota (429) is not retried: it will not come back in
 * seconds, so the run moves straight to the next model instead.
 */
export const GEMINI_RETRY_OPTIONS = {
  attempts: 3,
  initialDelay: 1,
  maxDelay: 4,
  httpStatusCodes: RETRYABLE_STATUS_CODES,
};

export function describeGeminiError(error: unknown): string {
  if (isQuotaError(error)) {
    return "The free Gemini quota is used up for now. It resets over time; try again later, or add a paid Gemini key.";
  }
  if (isUnavailableError(error)) {
    return "Gemini is too busy to answer right now (high demand on Google's side). Try again in a minute.";
  }
  if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403)) {
    return `Gemini refused the request (${error.status}). Check that GEMINI_API_KEY in .env.local is a valid key.`;
  }
  if (error instanceof ApiError) return `The Gemini API returned an error (${error.status}).`;
  return error instanceof Error ? error.message : String(error);
}

/** Calls Gemini. Tests pass a stand-in so no network or key is needed. */
export type GenerateFunction = (request: GenerateContentParameters) => Promise<GenerateContentResponse>;

function liveGenerate(): GenerateFunction {
  let client: GoogleGenAI | undefined;
  return (request) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add your key from Google AI Studio to .env.local.");
    client ??= new GoogleGenAI({ apiKey, httpOptions: { retryOptions: GEMINI_RETRY_OPTIONS } });
    return client.models.generateContent(request);
  };
}

/**
 * A ModelProvider backed by Gemini. Create one per question: it remembers
 * which model it is on, so once a run falls back to a second model (because
 * the first is out of free quota or too busy), it stays there.
 */
export function createGeminiProvider(
  options: { models?: string[]; generate?: GenerateFunction } = {},
): ModelProvider {
  const models = options.models ?? geminiModels();
  const generate = options.generate ?? liveGenerate();
  let current = 0;

  return {
    label: `Gemini (${models[0]})`,
    describeError: describeGeminiError,
    buildRequest: (input) => buildGeminiRequest(models[current], input) as unknown as Record<string, unknown>,
    async send(request): Promise<SentRequest> {
      for (;;) {
        const attempt = { ...request, model: models[current] } as unknown as GenerateContentParameters;
        try {
          const response = await generate(attempt);
          return {
            sent: attempt as unknown as Record<string, unknown>,
            raw: plainResponse(response),
            reply: readGeminiResponse(response),
          };
        } catch (error) {
          const canFallBack = shouldTryNextModel(error) && current < models.length - 1;
          if (!canFallBack) throw error;
          current += 1;
        }
      }
    },
  };
}
