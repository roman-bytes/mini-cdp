import type { Metadata } from "next";
import { Suspense } from "react";

import { PeopleDirectory } from "@/apps/people/components/people-directory";
import { listPeople } from "@/apps/people/directory";
import { parsePeopleParams } from "@/apps/people/people-params";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { getToday } from "@/shared/today";

export const metadata: Metadata = { title: "People" };

/** The filtered, sorted list, read fresh on every request. */
async function Everyone({ searchParams }: Pick<PageProps<"/people">, "searchParams">) {
  const params = parsePeopleParams(await searchParams);
  const db = await getLiveDb();
  const result = await listPeople(db, { ...params, today: getToday() });
  return <PeopleDirectory params={params} result={result} basePath="/people" searchLabel="Search people" />;
}

export default function PeoplePage({ searchParams }: PageProps<"/people">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Everyone the newsletter, the website and the app know about. Filter, sort, and open anyone to see their full record."
      />
      <Suspense fallback={<LoadingMessage />}>
        <Everyone searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
