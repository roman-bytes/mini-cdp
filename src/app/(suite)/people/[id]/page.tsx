import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { listAccountsForPerson, listEventsForPerson } from "@/apps/mobile/activity";
import { summariseEvents } from "@/apps/mobile/activity-summary";
import { KindBadge, personName } from "@/apps/people/components/person-labels";
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
import { LoadingMessage } from "@/components/loading-message";
import { Section } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { firstParam } from "@/shared/format";
import { getToday } from "@/shared/today";

/**
 * One person, with what every app knows about them: newsletter, website and
 * mobile app in one view. Read fresh on every request.
 */
async function PersonProfile({ params, searchParams }: PageProps<"/people/[id]">) {
  const { id } = await params;
  const source = firstParam((await searchParams).source) ?? "all";

  const db = await getLiveDb();
  const profile = await getProfile(db, id);
  if (!profile) notFound();

  const identifiers = await listIdentifiers(db, id);
  const accounts = await listAccountsForPerson(db, id);
  const visits = await listVisitsForPerson(db, id);
  const events = await listEventsForPerson(db, id);
  const timeline = filterTimeline(buildTimeline(visits, events), source);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/people" className="text-sm text-muted-foreground hover:text-foreground">
          ← People
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{personName(profile)}</h1>
          <KindBadge kind={profile.kind} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <NewsletterCard profile={profile} today={getToday()} />
        <WebCard profile={profile} />
        <AppCard accounts={accounts} summary={summariseEvents(events)} />
      </div>

      <Section title="Identity">
        <IdentityTable identifiers={identifiers} />
      </Section>

      <Section title="Activity">
        <TimelineFilter basePath={`/people/${id}`} current={source} />
        <TimelineTable entries={timeline} />
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
