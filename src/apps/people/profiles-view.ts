import { and, eq, isNull, sql } from "drizzle-orm";
import { boolean, date, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { SUBSCRIPTION_STATUSES } from "@/apps/newsletter/schema";

import { peopleSchema } from "./schema";

/** What we know a person as, worked out from what the other apps hold. */
export const PERSON_KINDS = ["subscriber", "app_only", "unknown"] as const;
export type PersonKind = (typeof PERSON_KINDS)[number];

/**
 * One row per person with everything the other apps know about them. The
 * People list, the profile page and segments all read this one view, so they
 * always agree, and it is computed live, so new events show up at once.
 */
export const profiles = peopleSchema
  .view("profiles", {
    personId: uuid("person_id").notNull(),
    email: text("email"),
    kind: text("kind", { enum: PERSON_KINDS }).notNull(),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }),
    acquisitionSource: text("acquisition_source"),
    signupDate: date("signup_date", { mode: "string" }),
    lastOpenDate: date("last_open_date", { mode: "string" }),
    hasAppAccount: boolean("has_app_account").notNull(),
    appAccountCreatedOn: date("app_account_created_on", { mode: "string" }),
    webVisitCount: integer("web_visit_count").notNull(),
    firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
    appEventCount: integer("app_event_count").notNull(),
    lastAppEventAt: timestamp("last_app_event_at", { withTimezone: true }),
  })
  .as(sql`
    select
      p.id as person_id,
      (
        select i.value from people.identifiers i
        where i.person_id = p.id and i.type = 'email'
        order by i.created_at, i.value
        limit 1
      ) as email,
      case
        when s.person_id is not null then 'subscriber'
        when a.person_id is not null then 'app_only'
        else 'unknown'
      end as kind,
      s.status,
      s.acquisition_source,
      s.signup_date,
      s.last_open_date,
      (a.person_id is not null) as has_app_account,
      a.created_on as app_account_created_on,
      coalesce(v.visit_count, 0)::int as web_visit_count,
      v.first_visit_at,
      v.last_visit_at,
      coalesce(e.event_count, 0)::int as app_event_count,
      e.last_event_at as last_app_event_at
    from people.people p
    left join newsletter.subscriptions s on s.person_id = p.id
    left join (
      select person_id, min(created_on) as created_on
      from mobile.accounts
      group by person_id
    ) a on a.person_id = p.id
    left join (
      select person_id, count(*) as visit_count,
        min(occurred_at) as first_visit_at, max(occurred_at) as last_visit_at
      from web.visits
      where person_id is not null
      group by person_id
    ) v on v.person_id = p.id
    left join (
      select person_id, count(*) as event_count, max(occurred_at) as last_event_at
      from mobile.events
      where person_id is not null
      group by person_id
    ) e on e.person_id = p.id
  `);

/** True for a subscriber who has never opened an email. */
export const neverOpened = and(eq(profiles.kind, "subscriber"), isNull(profiles.lastOpenDate))!;
