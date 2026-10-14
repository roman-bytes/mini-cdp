"use server";

import { redirect } from "next/navigation";

import { createGeminiProvider } from "@/apps/assistant/gemini";
import { askAssistant } from "@/apps/assistant/run";
import { getDb } from "@/shared/db/client";
import { getToday } from "@/shared/today";

/** Asks the assistant a question, then opens the answer. */
export async function askAssistantAction(formData: FormData): Promise<void> {
  const question = String(formData.get("question") ?? "").trim().slice(0, 1000);
  if (question === "") return;

  const runId = await askAssistant(getDb(), question, { provider: createGeminiProvider(), today: getToday() });
  redirect(`/assistant/${runId}`);
}
