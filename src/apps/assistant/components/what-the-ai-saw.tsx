import type { ModelCall } from "../runs";

function Json({ value }: { value: unknown }) {
  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

type Request = { config?: { systemInstruction?: unknown; tools?: unknown }; contents?: unknown[] };
type Response = { candidates?: { content?: unknown }[] };

/** The newest turn in a request: what this step added to the conversation. */
export function newestTurn(request: Request): unknown {
  return request.contents?.at(-1) ?? null;
}

/** What the model sent back: its turn, with any text and tool calls. */
export function replyOf(response: Response): unknown {
  return response.candidates?.[0]?.content ?? null;
}

/**
 * Every request sent to the AI and every reply, exactly as stored. The system
 * prompt and tools are the same on each request, so they are shown once.
 */
export function WhatTheAiSaw({ calls }: { calls: ModelCall[] }) {
  if (calls.length === 0) return <p className="text-sm text-muted-foreground">Nothing was sent to the AI.</p>;
  const first = calls[0].request as Request;

  return (
    <div className="space-y-3 text-sm">
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">Instructions and tools (the same on every request)</summary>
        <div className="mt-3 space-y-3">
          <Json value={first.config?.systemInstruction} />
          <Json value={first.config?.tools} />
        </div>
      </details>

      {calls.map((call) => {
        const request = call.request as Request;
        return (
          <details key={call.id} className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">
              Request {call.step}
              {call.piiFindings.length > 0 ? ` (stopped: contained an ${call.piiFindings.join(" and an ")})` : ""}
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-muted-foreground">New in this request:</p>
              <Json value={newestTurn(request)} />
              {call.response ? (
                <>
                  <p className="text-muted-foreground">The AI replied:</p>
                  <Json value={replyOf(call.response as Response)} />
                </>
              ) : (
                <p className="text-muted-foreground">No reply: this request was not sent.</p>
              )}
              <details>
                <summary className="cursor-pointer text-muted-foreground">The full request, exactly as sent</summary>
                <Json value={call.request} />
              </details>
            </div>
          </details>
        );
      })}
    </div>
  );
}
