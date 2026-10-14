import { ApiError, type GenerateContentResponse } from "@google/genai";
import { describe, expect, it } from "vitest";

import type { ChatTurn } from "./conversation";
import {
  buildGeminiRequest,
  createGeminiProvider,
  DEFAULT_GEMINI_MODELS,
  describeGeminiError,
  geminiModels,
  isQuotaError,
  plainResponse,
  readGeminiResponse,
  toGeminiContents,
} from "./gemini";

const TOOLS = [{ name: "run_query", description: "Run SQL", parameters: { type: "object", properties: {} } }];

function quotaError(): ApiError {
  return new ApiError({ message: "quota", status: 429 });
}

function response(parts: unknown[], finishReason = "STOP"): GenerateContentResponse {
  return { candidates: [{ content: { role: "model", parts }, finishReason }] } as unknown as GenerateContentResponse;
}

describe("geminiModels", () => {
  it("uses the free-tier defaults when nothing is set", () => {
    expect(geminiModels(undefined)).toEqual(DEFAULT_GEMINI_MODELS);
    expect(geminiModels(" ")).toEqual(DEFAULT_GEMINI_MODELS);
  });

  it("reads a comma-separated list from the setting", () => {
    expect(geminiModels("gemini-a, gemini-b")).toEqual(["gemini-a", "gemini-b"]);
  });
});

describe("toGeminiContents", () => {
  it("sends the question, the model's turn unchanged, and tool results as function responses", () => {
    const modelTurn = { role: "model", parts: [{ functionCall: { name: "run_query", args: {} }, thoughtSignature: "sig" }] };
    const turns: ChatTurn[] = [
      { role: "user", text: "How many?" },
      { role: "model", providerContent: modelTurn },
      { role: "tool", results: [{ name: "run_query", content: '{"rows":[[1]]}', isError: false }] },
    ];

    expect(toGeminiContents(turns)).toEqual([
      { role: "user", parts: [{ text: "How many?" }] },
      modelTurn,
      { role: "user", parts: [{ functionResponse: { name: "run_query", response: { rows: [[1]] } } }] },
    ]);
  });

  it("keeps a call ID when the model gave one, and wraps text that is not an object", () => {
    const [content] = toGeminiContents([
      { role: "tool", results: [{ callId: "call-1", name: "run_query", content: "plain text", isError: true }] },
    ]);

    expect(content.parts).toEqual([
      { functionResponse: { id: "call-1", name: "run_query", response: { result: "plain text" } } },
    ]);
  });
});

describe("buildGeminiRequest", () => {
  it("puts the instructions and tools in the config", () => {
    const request = buildGeminiRequest("gemini-3.8-flash", {
      system: "You are the data assistant",
      turns: [{ role: "user", text: "Hi" }],
      tools: TOOLS,
    });

    expect(request).toMatchObject({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: "Hi" }] }],
      config: {
        systemInstruction: "You are the data assistant",
        tools: [{ functionDeclarations: [{ name: "run_query", description: "Run SQL", parametersJsonSchema: TOOLS[0].parameters }] }],
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      },
    });
  });
});

describe("readGeminiResponse", () => {
  it("reads tool calls, keeping the model's turn to send back", () => {
    const parts = [{ functionCall: { id: "c1", name: "run_query", args: { sql: "select 1" } }, thoughtSignature: "sig" }];
    const reply = readGeminiResponse(response(parts));

    expect(reply).toEqual({
      text: "",
      toolCalls: [{ id: "c1", name: "run_query", input: { sql: "select 1" } }],
      refused: false,
      providerContent: { role: "model", parts },
    });
  });

  it("reads the answer text and skips thought parts", () => {
    const reply = readGeminiResponse(response([{ text: "thinking…", thought: true }, { text: "76 went cold." }]));

    expect(reply).toMatchObject({ text: "76 went cold.", toolCalls: [], refused: false });
  });

  it("treats a safety stop with nothing to show, a blocked prompt, or no candidate as a refusal", () => {
    expect(readGeminiResponse(response([], "SAFETY")).refused).toBe(true);
    expect(readGeminiResponse({ promptFeedback: { blockReason: "SAFETY" } } as GenerateContentResponse).refused).toBe(true);
    expect(readGeminiResponse({ candidates: [] } as unknown as GenerateContentResponse).refused).toBe(true);
  });
});

describe("plainResponse", () => {
  it("keeps the reply and usage but drops the HTTP details", () => {
    const raw = { ...response([{ text: "ok" }]), modelVersion: "gemini-3.8-flash", sdkHttpResponse: { headers: { secret: "x" } } };

    expect(plainResponse(raw as unknown as GenerateContentResponse)).not.toHaveProperty("sdkHttpResponse");
    expect(plainResponse(raw as unknown as GenerateContentResponse)).toMatchObject({ modelVersion: "gemini-3.8-flash" });
  });
});

describe("errors", () => {
  it("recognises a used-up free quota", () => {
    expect(isQuotaError(quotaError())).toBe(true);
    expect(isQuotaError(new Error("other"))).toBe(false);
    expect(describeGeminiError(quotaError())).toMatch(/free Gemini quota is used up/);
  });

  it("points at the key when Gemini refuses the request", () => {
    expect(describeGeminiError(new ApiError({ message: "bad key", status: 400 }))).toMatch(/GEMINI_API_KEY/);
    expect(describeGeminiError(new ApiError({ message: "boom", status: 500 }))).toBe("The Gemini API returned an error (500).");
    expect(describeGeminiError(new Error("network down"))).toBe("network down");
  });
});

describe("createGeminiProvider", () => {
  const input = { system: "s", turns: [{ role: "user" as const, text: "q" }], tools: TOOLS };

  it("sends the request and returns the reply", async () => {
    const provider = createGeminiProvider({
      models: ["model-a"],
      generate: async () => response([{ text: "Answer" }]),
    });

    const result = await provider.send(provider.buildRequest(input));

    expect(provider.label).toBe("Gemini (model-a)");
    expect(result.sent).toMatchObject({ model: "model-a" });
    expect(result.reply.text).toBe("Answer");
  });

  it("moves to the next model when the free quota runs out, and stays there", async () => {
    const asked: string[] = [];
    const provider = createGeminiProvider({
      models: ["model-a", "model-b"],
      generate: async (request) => {
        asked.push(request.model);
        if (request.model === "model-a") throw quotaError();
        return response([{ text: "From b" }]);
      },
    });

    const first = await provider.send(provider.buildRequest(input));
    await provider.send(provider.buildRequest(input));

    expect(first.sent).toMatchObject({ model: "model-b" });
    expect(asked).toEqual(["model-a", "model-b", "model-b"]);
  });

  it("gives up when the last model is out of quota too", async () => {
    const provider = createGeminiProvider({ models: ["only"], generate: async () => { throw quotaError(); } });

    await expect(provider.send(provider.buildRequest(input))).rejects.toBeInstanceOf(ApiError);
  });

  it("explains a missing key", async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const provider = createGeminiProvider({ models: ["model-a"] });

    await expect(provider.send(provider.buildRequest(input))).rejects.toThrow(/GEMINI_API_KEY is not set/);
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  });
});
