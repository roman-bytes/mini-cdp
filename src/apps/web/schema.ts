import { bigserial, index, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { people } from "@/apps/people/schema";
import { rawRowColumns, rawSchema } from "@/shared/raw/schema";

/** Web owns website visits. */
export const webSchema = pgSchema("web");

/** One row per page view. `personId` is null while the visitor is anonymous. */
export const visits = webSchema.table(
  "visits",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    visitorId: text("visitor_id").notNull(),
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    page: text("page").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /** Stored channel name, see shared/channels.ts. Null when untagged. */
    utmSource: text("utm_source"),
  },
  (table) => [
    index("visits_person_id_idx").on(table.personId),
    index("visits_visitor_id_idx").on(table.visitorId),
    index("visits_occurred_at_idx").on(table.occurredAt),
  ],
);

/** web_events.csv exactly as it arrived. */
export const rawWebEvents = rawSchema.table("web_events", {
  ...rawRowColumns(),
  visitorId: text("visitor_id"),
  page: text("page"),
  timestamp: text("timestamp"),
  utmSource: text("utm_source"),
  email: text("email"),
});
