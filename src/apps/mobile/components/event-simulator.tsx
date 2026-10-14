"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { SimulatedEventInput, SimulationResult } from "../simulate";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type EventSimulatorProps = {
  eventNames: readonly string[];
  /** Sends the event on the server and returns what happened to it. */
  send: (input: SimulatedEventInput) => Promise<SimulationResult>;
};

function ResultMessage({ result }: { result: SimulationResult }) {
  if (!result.ok) {
    return (
      <ul role="alert" className="text-sm text-destructive">
        {result.errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    );
  }
  return (
    <p role="status" className="text-sm">
      Event {result.status}.{" "}
      {result.personId ? (
        <Link className="font-medium underline underline-offset-4" href={`/people/${result.personId}`}>
          It belongs to this person.
        </Link>
      ) : (
        "It is anonymous until this device logs in."
      )}
    </p>
  );
}

/**
 * Sends made-up app events, to watch the webhook's rules at work: send a few
 * events with no user ID, then a login with one, and the earlier events attach.
 */
export function EventSimulator({ eventNames, send }: EventSimulatorProps) {
  const [input, setInput] = useState<SimulatedEventInput>({
    event: eventNames[0],
    deviceId: "d_demo_1",
    userId: "",
    story: "",
  });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSending, setIsSending] = useState(false);

  function setField(field: keyof SimulatedEventInput, value: string) {
    setInput({ ...input, [field]: value });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSending(true);
    setResult(await send(input));
    setIsSending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="sim-event">Event</Label>
          <select
            id="sim-event"
            className={selectClass}
            value={input.event}
            onChange={(change) => setField("event", change.target.value)}
          >
            {eventNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sim-device">Device ID</Label>
          <Input id="sim-device" value={input.deviceId} onChange={(change) => setField("deviceId", change.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sim-user">User ID (empty = not logged in)</Label>
          <Input
            id="sim-user"
            placeholder="u_2b6447a3"
            value={input.userId}
            onChange={(change) => setField("userId", change.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sim-story">Story (optional)</Label>
          <Input
            id="sim-story"
            placeholder="supreme-court-ruling-explained"
            value={input.story}
            onChange={(change) => setField("story", change.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSending}>
          {isSending ? "Sending…" : "Send event"}
        </Button>
        {result ? <ResultMessage result={result} /> : null}
      </div>
    </form>
  );
}
