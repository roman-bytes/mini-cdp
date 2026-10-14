/**
 * The assistant's conversation in a shape that belongs to no AI provider.
 * The question-answering loop works only with these types; the provider
 * file (gemini.ts) turns them into the provider's own request format.
 */

/** A tool the model may call, described with a JSON Schema for its input. */
export type ToolSpec = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** One call the model asked for. Some providers give each call an ID. */
export type ToolCall = {
  id?: string;
  name: string;
  input: Record<string, unknown>;
};

/** What running a tool call produced, to send back to the model. */
export type ToolResult = {
  callId?: string;
  name: string;
  /** JSON text. */
  content: string;
  isError: boolean;
};

export type ChatTurn =
  | { role: "user"; text: string }
  /** `providerContent` is the model's turn exactly as received, sent back unchanged. */
  | { role: "model"; providerContent: unknown }
  | { role: "tool"; results: ToolResult[] };

/** The parts of a model reply the loop acts on. */
export type ModelReply = {
  text: string;
  toolCalls: ToolCall[];
  /** True when the provider declined to answer, for example on a safety filter. */
  refused: boolean;
  /** The model's turn exactly as received, to append to the conversation. */
  providerContent: unknown;
};

/** What one request to the model produced. */
export type SentRequest = {
  /** The request exactly as it was sent (after any switch to a fallback model). */
  sent: Record<string, unknown>;
  /** The provider's reply, as plain data, for the audit record. */
  raw: unknown;
  reply: ModelReply;
};

/**
 * An AI provider. buildRequest makes the exact payload; the loop checks that
 * payload for personal data before handing it to send.
 */
export type ModelProvider = {
  /** For display, e.g. "Gemini (gemini-3.8-flash)". */
  label: string;
  buildRequest(input: { system: string; turns: ChatTurn[]; tools: ToolSpec[] }): Record<string, unknown>;
  send(request: Record<string, unknown>): Promise<SentRequest>;
  /** A plain-English reason for a failed request. */
  describeError(error: unknown): string;
};
