-- The assistant's window into the data.
--
-- The AI assistant writes SQL, and that SQL only ever runs as the ai_reader
-- role. ai_reader can read the views in the "ai" schema and nothing else, and
-- those views leave out every email and every raw ID (visitor, user, device).
-- A person appears only as person_key, a random UUID that says nothing about
-- them; the app turns keys back into people after the model has finished.

CREATE SCHEMA IF NOT EXISTS ai;
--> statement-breakpoint

-- One row per person: everything the profile shows, except the email.
CREATE VIEW ai.people AS
SELECT
  person_id AS person_key,
  kind,
  status,
  acquisition_source,
  signup_date,
  last_open_date,
  has_app_account,
  app_account_created_on,
  web_visit_count,
  first_visit_at,
  last_visit_at,
  app_event_count,
  last_app_event_at
FROM people.profiles;
--> statement-breakpoint

-- One row per page view. The visitor ID is replaced by a plain number that
-- groups a visitor's views without revealing the ID.
CREATE VIEW ai.web_visits AS
SELECT
  v.id AS visit_id,
  v.person_id AS person_key,
  dense_rank() OVER (ORDER BY v.visitor_id)::int AS visitor_number,
  v.page,
  v.occurred_at,
  v.utm_source
FROM web.visits v;
--> statement-breakpoint

-- One row per app event. Only the story property is passed through; any other
-- property could hold free text, so it stays out.
CREATE VIEW ai.app_events AS
SELECT
  e.person_id AS person_key,
  dense_rank() OVER (ORDER BY e.device_id)::int AS device_number,
  e.event,
  e.occurred_at,
  e.received_at,
  e.properties ->> 'story' AS story
FROM mobile.events e;
--> statement-breakpoint

CREATE VIEW ai.segments AS
SELECT id AS segment_id, name, created_at
FROM people.segments;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_reader') THEN
    CREATE ROLE ai_reader NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint

GRANT USAGE ON SCHEMA ai TO ai_reader;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA ai TO ai_reader;
--> statement-breakpoint

-- The app's own database user switches to ai_reader only while it runs the
-- assistant's SQL, inside a read-only transaction.
GRANT ai_reader TO CURRENT_USER;
