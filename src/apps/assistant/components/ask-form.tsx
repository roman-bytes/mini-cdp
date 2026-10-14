"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/** The questions from the brief, offered as a starting point. */
export const EXAMPLE_QUESTIONS = [
  "How many Instagram signups went cold last month?",
  "Build me a list of our most engaged readers",
  "Which pages do new subscribers hit first?",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Working it out…" : "Ask"}
      </Button>
      {pending ? (
        <p role="status" className="text-sm text-muted-foreground">
          The assistant is querying the data. This can take up to a minute.
        </p>
      ) : null}
    </div>
  );
}

/** A box for a plain-English question, with example questions to start from. */
export function AskForm({ ask }: { ask: (formData: FormData) => Promise<void> }) {
  const [question, setQuestion] = useState("");

  return (
    <form action={ask} className="space-y-3">
      <textarea
        name="question"
        aria-label="Your question"
        required
        maxLength={1000}
        rows={3}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Ask about subscribers, signups, website visits or app activity…"
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setQuestion(example)}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {example}
          </button>
        ))}
      </div>
      <SubmitButton />
    </form>
  );
}
