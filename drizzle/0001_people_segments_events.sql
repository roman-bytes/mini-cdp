CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE TABLE "mobile"."events" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"user_id" text,
	"device_id" text NOT NULL,
	"person_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw"."webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people"."segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."rate_limits" (
	"subject" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_subject_window_start_pk" PRIMARY KEY("subject","window_start")
);
--> statement-breakpoint
ALTER TABLE "mobile"."events" ADD CONSTRAINT "events_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "people"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_device_id_occurred_at_idx" ON "mobile"."events" USING btree ("device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_person_id_idx" ON "mobile"."events" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "mobile"."events" USING btree ("occurred_at");--> statement-breakpoint
CREATE VIEW "people"."profiles" AS (
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
  );