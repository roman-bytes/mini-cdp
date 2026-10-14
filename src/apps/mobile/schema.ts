import { date, index, jsonb, pgSchema, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { people } from "@/apps/people/schema";
import { rawRowColumns, rawSchema } from "@/shared/raw/schema";

/** Mobile owns app accounts and, later, the events the app sends. */
export const mobileSchema = pgSchema("mobile");

/** One row per app account. The account's email lives in People. */
export const accounts = mobileSchema.table(
  "accounts",
  {
    userId: text("user_id").primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdOn: date("created_on", { mode: "string" }).notNull(),
  },
  (table) => [index("accounts_person_id_idx").on(table.personId)],
);

/** app_users.csv exactly as it arrived. */
export const rawAppUsers = rawSchema.table("app_users", {
  ...rawRowColumns(),
  userId: text("user_id"),
  email: text("email"),
  createdAt: text("created_at"),
});

/** The event names the mobile app sends. */
export const APP_EVENT_NAMES = ["app_open", "read_story", "link_click", "login"] as const;
export type AppEventName = (typeof APP_EVENT_NAMES)[number];

/**
 * One row per event the app sent. The primary key is the app's own event ID,
 * so an event delivered twice is stored once.
 */
export const events = mobileSchema.table(
  "events",
  {
    id: text("id").primaryKey(),
    event: text("event", { enum: APP_EVENT_NAMES }).notNull(),
    /** As sent: null until the device logs in. */
    userId: text("user_id"),
    deviceId: text("device_id").notNull(),
    /** Who the event belongs to, once known. Anonymous events get this at login. */
    personId: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
    /** When it happened on the device. Events can arrive in any order. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [
    index("events_device_id_occurred_at_idx").on(table.deviceId, table.occurredAt),
    index("events_person_id_idx").on(table.personId),
    index("events_occurred_at_idx").on(table.occurredAt),
  ],
);

/** What happened to a webhook delivery. */
export const DELIVERY_OUTCOMES = ["accepted", "duplicate", "rejected"] as const;
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];

/** Where a delivery came from: the real webhook, or the event simulator in the app. */
export const DELIVERY_SOURCES = ["webhook", "simulator"] as const;
export type DeliverySource = (typeof DELIVERY_SOURCES)[number];

/** Every webhook delivery exactly as it arrived, including ones that were refused. */
export const rawWebhookEvents = rawSchema.table("webhook_events", {
  id: serial("id").primaryKey(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source", { enum: DELIVERY_SOURCES }).notNull().default("webhook"),
  outcome: text("outcome", { enum: DELIVERY_OUTCOMES }).notNull(),
  reason: text("reason"),
  body: text("body").notNull(),
});
