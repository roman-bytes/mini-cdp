"use server";

import { redirect } from "next/navigation";

import type { SegmentDefinition } from "@/apps/segments/definition";
import {
  previewSegment,
  saveCheckedSegment,
  type SaveResult,
  type SegmentPreview,
} from "@/apps/segments/preview";
import { deleteSegment } from "@/apps/segments/saved";
import { getDb } from "@/shared/db/client";
import { getToday } from "@/shared/today";

/** Runs the builder's rules and returns the count and a sample of people. */
export async function previewSegmentAction(definition: SegmentDefinition): Promise<SegmentPreview> {
  return previewSegment(getDb(), definition, getToday());
}

/** Saves a segment and opens it. Returns the problems when it cannot be saved. */
export async function saveSegmentAction(name: string, definition: SegmentDefinition): Promise<SaveResult> {
  const result = await saveCheckedSegment(getDb(), name, definition);
  if (result.ok) redirect(`/segments/${result.id}`);
  return result;
}

export async function deleteSegmentAction(formData: FormData): Promise<void> {
  await deleteSegment(getDb(), String(formData.get("id") ?? ""));
  redirect("/segments");
}
