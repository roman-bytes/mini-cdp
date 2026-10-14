import { date, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { people } from "@/apps/people/schema";
import { rawRowColumns, rawSchema } from "@/shared/raw/schema";

/** Newsletter owns what beehiiv knows about a person's subscription. */
export const newsletterSchema = pgSchema("newsletter");

export const SUBSCRIPTION_STATUSES = ["active", "unsubscribed"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** One row per subscriber. The email itself lives in People. */
export const subscriptions = newsletterSchema.table("subscriptions", {
  personId: uuid("person_id")
    .primaryKey()
    .references(() => people.id, { onDelete: "cascade" }),
  status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull(),
  /** Stored channel name, see shared/channels.ts. Null when unknown. */
  acquisitionSource: text("acquisition_source"),
  signupDate: date("signup_date", { mode: "string" }).notNull(),
  /** Null means the person has never opened an email. */
  lastOpenDate: date("last_open_date", { mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** subscribers.csv exactly as it arrived. */
export const rawSubscribers = rawSchema.table("subscribers", {
  ...rawRowColumns(),
  email: text("email"),
  signupDate: text("signup_date"),
  status: text("status"),
  acquisitionSource: text("acquisition_source"),
  lastOpenDate: text("last_open_date"),
});
