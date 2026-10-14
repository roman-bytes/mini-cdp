import type { Metadata } from "next";
import { Suspense } from "react";

import { listRecentEvents } from "@/apps/mobile/activity";
import { EventSimulator } from "@/apps/mobile/components/event-simulator";
import { EventsTable } from "@/apps/mobile/components/events-table";
import { latestDeliveryMarker } from "@/apps/mobile/deliveries";
import { APP_EVENT_NAMES } from "@/apps/mobile/schema";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader, Section } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { DELIVERY_MARKER_URL } from "@/shared/live-urls";
import { pageDrawnAt } from "@/shared/recent";

import { sendSimulatedEventAction } from "./actions";

export const metadata: Metadata = { title: "Mobile" };

const RECENT_EVENT_LIMIT = 100;

/** The latest events, read fresh, and again whenever a new one arrives. */
async function RecentEvents() {
  const db = await getLiveDb();
  // Read before the events, so one that lands meanwhile is not missed.
  const marker = await latestDeliveryMarker(db);
  const events = await listRecentEvents(db, RECENT_EVENT_LIMIT);

  return (
    <>
      <LiveRefresh markerUrl={DELIVERY_MARKER_URL} initialMarker={marker} />
      <EventsTable events={events} renderedAt={pageDrawnAt()} />
    </>
  );
}

export default function MobilePage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Mobile"
        description="Events the app sends to POST /webhooks/app. New ones appear as they arrive, and anything from the last hour is green."
      />

      <Section title="Send a test event">
        <p className="text-sm text-muted-foreground">
          Goes through the same checks and the same code as the webhook. Send events with no user ID, then
          a login with one, and watch the earlier events attach to that person.
        </p>
        <EventSimulator eventNames={APP_EVENT_NAMES} send={sendSimulatedEventAction} />
      </Section>

      <Section title="Latest events">
        <Suspense fallback={<LoadingMessage />}>
          <RecentEvents />
        </Suspense>
      </Section>
    </div>
  );
}
