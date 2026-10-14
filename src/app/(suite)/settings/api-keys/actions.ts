"use server";

import { refresh } from "next/cache";

import { createApiKey, revokeApiKey } from "@/shared/auth/api-keys";
import type { CreateKeyState } from "@/shared/auth/components/api-key-form";
import { getDb } from "@/shared/db/client";

/** Creates a key and returns it once, for the form to show. */
export async function createApiKeyAction(_previous: CreateKeyState, formData: FormData): Promise<CreateKeyState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name === "") return { error: "Give the key a name, so you know what uses it." };

  const created = await createApiKey(getDb(), name);
  refresh();
  return { key: created.key, name: created.name };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  await revokeApiKey(getDb(), String(formData.get("id") ?? ""));
  refresh();
}
