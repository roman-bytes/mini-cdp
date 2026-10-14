"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** What creating a key returns: the key itself, shown this one time. */
export type CreateKeyState = { key: string; name: string } | { error: string } | null;

type ApiKeyFormProps = {
  create: (previous: CreateKeyState, formData: FormData) => Promise<CreateKeyState>;
  /** Where the webhook lives, used to show a ready-to-run example. */
  webhookUrl: string;
};

/** A curl command that sends the brief's sample event with this key. */
export function curlExample(webhookUrl: string, key: string): string {
  const body = {
    event_id: "evt_9f3a1c",
    event: "read_story",
    user_id: "u_2b6447a3",
    device_id: "d_4b21e8",
    timestamp: "2026-09-28T14:22:05Z",
    properties: { story: "supreme-court-ruling-explained" },
  };
  return [
    `curl -X POST ${webhookUrl} \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body)}'`,
  ].join("\n");
}

/** Creates an API key and shows it once, with an example of how to use it. */
export function ApiKeyForm({ create, webhookUrl }: ApiKeyFormProps) {
  const [state, formAction, isPending] = useActionState(create, null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <Input name="name" aria-label="Key name" placeholder="What will use this key? e.g. Mobile app" className="w-80" />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create key"}
        </Button>
      </form>

      {state && "error" in state ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state && "key" in state ? (
        <div role="status" className="space-y-2 rounded-xl border p-4">
          <p className="text-sm font-medium">
            Key for “{state.name}” created. Copy it now. It is not stored and will not be shown again.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm">{state.key}</pre>
          <p className="text-sm text-muted-foreground">Try it:</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
            {curlExample(webhookUrl, state.key)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
