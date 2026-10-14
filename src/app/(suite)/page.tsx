import type { Metadata } from "next";
import { Suspense } from "react";

import { PeopleOverview } from "@/apps/people/components/dashboard/people-overview";
import { getOverview } from "@/apps/people/dashboard";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { formatDate } from "@/shared/format";
import { getToday } from "@/shared/today";

export const metadata: Metadata = { title: "Home" };

/** The headline numbers and charts, counted live on every request. */
async function Overview() {
  const db = await getLiveDb();
  const today = getToday();
  const data = await getOverview(db, today);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">As of {formatDate(today)}</p>
      <PeopleOverview data={data} />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Home" description="How the subscriber base is growing, where it can be reached, and which sources keep opening." />
      <Suspense fallback={<LoadingMessage />}>
        <Overview />
      </Suspense>
    </div>
  );
}
