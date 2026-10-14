import type { Metadata } from "next";
import { Suspense } from "react";

import { PeopleOverview, type OverviewData } from "@/apps/people/components/dashboard/people-overview";
import { PeopleTable } from "@/apps/people/components/people-table";
import {
  getEngagementBySource,
  getHeadlineStats,
  getReach,
  getWeeklySignups,
} from "@/apps/people/dashboard";
import { searchPeople } from "@/apps/people/directory";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader, Section } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Db } from "@/shared/db/client";
import { getLiveDb } from "@/shared/db/live";
import { firstParam, formatDate } from "@/shared/format";
import { getToday } from "@/shared/today";

export const metadata: Metadata = { title: "People" };

/** The link to a page of the list, keeping the current search. */
function peopleHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const queryString = params.toString();
  return queryString ? `/people?${queryString}` : "/people";
}

function SearchForm({ query }: { query: string }) {
  return (
    <form action="/people" className="flex w-full max-w-md gap-2" role="search">
      <Input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Email, user ID, visitor ID or device ID"
        aria-label="Search people"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}

async function loadOverview(db: Db, today: string): Promise<OverviewData> {
  return {
    stats: await getHeadlineStats(db, today),
    weeks: await getWeeklySignups(db, today),
    sources: await getEngagementBySource(db, today),
    reach: await getReach(db),
  };
}

/**
 * The People home: headline numbers and charts, then everyone. While
 * searching or paging, the numbers step aside so the results come first.
 */
async function PeopleContent({ searchParams }: Pick<PageProps<"/people">, "searchParams">) {
  const params = await searchParams;
  const query = firstParam(params.q)?.trim() ?? "";
  const db = await getLiveDb();
  const result = await searchPeople(db, { query, page: Number(firstParam(params.page) ?? 1) });
  const isBrowsing = query !== "" || result.page > 1;
  const today = getToday();

  return (
    <div className="space-y-10">
      <SearchForm query={query} />

      {isBrowsing ? null : (
        <Section title={`Overview, as of ${formatDate(today)}`}>
          <PeopleOverview data={await loadOverview(db, today)} />
        </Section>
      )}

      <Section title={query ? `People matching “${query}”` : "Everyone"}>
        <PeopleTable people={result.people} />
        <Pagination
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          hrefForPage={(page) => peopleHref(query, page)}
        />
      </Section>
    </div>
  );
}

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Everyone the newsletter, the website and the app know about. Open a person to see everything in one place."
      />
      <Suspense fallback={<LoadingMessage />}>
        <PeopleContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
