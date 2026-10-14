import type { Metadata } from "next";
import { Suspense } from "react";

import { listRecentEvents } from "@/apps/mobile/activity";
import { EventSimulator } from "@/apps/mobile/components/event-simulator";
import { EventsTable } from "@/apps/mobile/components/events-table";
import { APP_EVENT_NAMES } from "@/apps/mobile/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader, Section } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";

import { sendSimulatedEventAction } from "./actions";

export const metadata: Metadata = { title: "Mobile" };

const RECENT_EVENT_LIMIT = 100;

/** The latest events, read from the database on every request. */
async function RecentEvents() {
  const events = await listRecentEvents(await getLiveDb(), RECENT_EVENT_LIMIT);
  return <EventsTable events={events} />;
}

export default function MobilePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Mobile"
        description="Events the app sends to POST /webhooks/app, as they arrive. This list refreshes every few seconds."
      />

      <Section title="Send a test event">
        <p className="text-sm text-muted-foreground">
          Goes through the same checks and the same code as the webhook. Send events with no user ID, then
          a login with one, and watch the earlier events attach to that person.
        </p>
        <EventSimulator eventNames={APP_EVENT_NAMES} send={sendSimulatedEventAction} />
      </Section>

      <Section title="Latest events">
        <AutoRefresh everySeconds={5} />
        <Suspense fallback={<LoadingMessage />}>
          <RecentEvents />
        </Suspense>
      </Section>
    </div>
  );
}
