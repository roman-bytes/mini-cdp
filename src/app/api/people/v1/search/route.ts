import { quickFind } from "@/apps/people/quick-find";
import { getDb } from "@/shared/db/client";

/**
 * GET /api/people/v1/search?q=text — the people whose email or ID contains
 * the text, for the search box in the top bar.
 */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json({ results: await quickFind(getDb(), query) });
}
