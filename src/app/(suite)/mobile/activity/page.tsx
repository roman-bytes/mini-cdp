import type { Metadata } from "next";
import { Suspense } from "react";

import { DeliveryLogTable } from "@/apps/mobile/components/delivery-log-table";
import { latestDeliveryMarker, listRecentDeliveries } from "@/apps/mobile/deliveries";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadingMessage } from "@/components/loading-message";
import { PageHeader } from "@/components/page-header";
import { getLiveDb } from "@/shared/db/live";
import { DELIVERY_MARKER_URL } from "@/shared/live-urls";
import { pageDrawnAt } from "@/shared/recent";

export const metadata: Metadata = { title: "Activity log" };

const LOG_LIMIT = 100;

/** The latest deliveries, read fresh, and again whenever a new one arrives. */
async function DeliveryLog() {
  const db = await getLiveDb();
  // Read before the log, so a delivery that lands meanwhile is not missed.
  const marker = await latestDeliveryMarker(db);
  const entries = await listRecentDeliveries(db, LOG_LIMIT);

  return (
    <>
      <LiveRefresh markerUrl={DELIVERY_MARKER_URL} initialMarker={marker} />
      <DeliveryLogTable entries={entries} renderedAt={pageDrawnAt()} />
    </>
  );
}

export default function ActivityLogPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description={`Every event sent to the webhook or the simulator, newest first, including duplicates and refused ones. New ones appear as they arrive, and anything from the last hour is green. Shows the latest ${LOG_LIMIT}.`}
      />
      <Suspense fallback={<LoadingMessage />}>
        <DeliveryLog />
      </Suspense>
    </div>
  );
}
