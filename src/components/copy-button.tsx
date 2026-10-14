"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type CopyState = "idle" | "copied" | "failed";

/** How long "Copied" shows before the button goes back to "Copy". */
export const COPY_RESET_MS = 2000;

const LABELS: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Couldn't copy",
};

type CopyButtonProps = {
  value: string;
  /** What is being copied, for screen readers, e.g. "person ID". */
  what: string;
};

/** A small button that copies a value to the clipboard and says when it has. */
export function CopyButton({ value, what }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setState("idle"), COPY_RESET_MS);
  }

  const Icon = state === "copied" ? Check : Copy;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={copy}
        aria-label={state === "idle" ? `Copy ${what}` : LABELS[state]}
      >
        <Icon data-icon="inline-start" aria-hidden="true" />
        {LABELS[state]}
      </Button>
      <span role="status" className="sr-only">
        {state === "copied" ? `${what} copied` : ""}
      </span>
    </>
  );
}
