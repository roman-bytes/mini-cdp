import { notFound } from "next/navigation";
import { Suspense } from "react";

import { listAccountsForPerson, listEventsForPerson, personActivityMarker } from "@/apps/mobile/activity";
import { summariseEvents } from "@/apps/mobile/activity-summary";
import { PersonHeader } from "@/apps/people/components/person-header";
import {
  AppCard,
  IdentityTable,
  NewsletterCard,
  WebCard,
} from "@/apps/people/components/profile-cards";
import { TimelineFilter, TimelineTable } from "@/apps/people/components/timeline-table";
import { getProfile } from "@/apps/people/directory";
import { listIdentifiers } from "@/apps/people/identifiers";
import { buildTimeline, filterTimeline } from "@/apps/people/timeline";
import { listVisitsForPerson } from "@/apps/web/visits";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadingMessage } from "@/components/loading-message";
import { Section } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { firstParam } from "@/shared/format";
import { personActivityMarkerUrl } from "@/shared/live-urls";
import { pageDrawnAt } from "@/shared/recent";
import { getToday } from "@/shared/today";

/**
 * One person, with what every app knows about them: newsletter, website and
 * mobile app in one view. Read fresh on every request, and again whenever a
 * new app event for them arrives while the page is open.
 */
async function PersonProfile({ params, searchParams }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const source = firstParam((await searchParams).source) ?? "all";

  const db = await getLiveDb();
  const profile = await getProfile(db, id);
  if (!profile) notFound();

  // Read before the activity, so an event that lands while the page is being
  // drawn changes the marker and is picked up by the next check.
  const marker = await personActivityMarker(db, id);
  const renderedAt = pageDrawnAt();

  const identifiers = await listIdentifiers(db, id);
  const accounts = await listAccountsForPerson(db, id);
  const visits = await listVisitsForPerson(db, id);
  const events = await listEventsForPerson(db, id);
  const timeline = filterTimeline(buildTimeline(visits, events), source);

  return (
    <div className="space-y-8">
      <PersonHeader profile={profile} />

      <div className="grid gap-4 lg:grid-cols-3">
        <NewsletterCard profile={profile} today={getToday()} />
        <WebCard profile={profile} />
        <AppCard accounts={accounts} summary={summariseEvents(events)} />
      </div>

      <Section title="Identity">
        <IdentityTable identifiers={identifiers} />
      </Section>

      <Section title="Activity">
        <LiveRefresh markerUrl={personActivityMarkerUrl(id)} initialMarker={marker} />
        <TimelineFilter basePath={`/people/${id}`} current={source} />
        <TimelineTable entries={timeline} renderedAt={renderedAt} />
      </Section>
    </div>
  );
}

export default function PersonPage(props: PageProps<"/people/[id]">) {
  return (
    <Suspense fallback={<LoadingMessage />}>
      <PersonProfile {...props} />
    </Suspense>
  );
}
