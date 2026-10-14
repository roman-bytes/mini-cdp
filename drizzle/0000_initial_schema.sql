CREATE SCHEMA "mobile";
--> statement-breakpoint
CREATE SCHEMA "newsletter";
--> statement-breakpoint
CREATE SCHEMA "people";
--> statement-breakpoint
CREATE SCHEMA "web";
--> statement-breakpoint
CREATE SCHEMA "raw";
--> statement-breakpoint
CREATE TABLE "mobile"."accounts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"person_id" uuid NOT NULL,
	"created_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw"."app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_number" integer NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"person_id" uuid,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text,
	"email" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "raw"."subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_number" integer NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"person_id" uuid,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text,
	"signup_date" text,
	"status" text,
	"acquisition_source" text,
	"last_open_date" text
);
--> statement-breakpoint
CREATE TABLE "newsletter"."subscriptions" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"acquisition_source" text,
	"signup_date" date NOT NULL,
	"last_open_date" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people"."identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people"."people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw"."web_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"row_number" integer NOT NULL,
	"outcome" text NOT NULL,
	"reason" text,
	"person_id" uuid,
	"loaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_id" text,
	"page" text,
	"timestamp" text,
	"utm_source" text,
	"email" text
);
--> statement-breakpoint
CREATE TABLE "web"."visits" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"person_id" uuid,
	"page" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"utm_source" text
);
--> statement-breakpoint
ALTER TABLE "mobile"."accounts" ADD CONSTRAINT "accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "people"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter"."subscriptions" ADD CONSTRAINT "subscriptions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "people"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people"."identifiers" ADD CONSTRAINT "identifiers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "people"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web"."visits" ADD CONSTRAINT "visits_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "people"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_person_id_idx" ON "mobile"."accounts" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identifiers_type_value_key" ON "people"."identifiers" USING btree ("type","value");--> statement-breakpoint
CREATE INDEX "identifiers_person_id_idx" ON "people"."identifiers" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "visits_person_id_idx" ON "web"."visits" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "visits_visitor_id_idx" ON "web"."visits" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "visits_occurred_at_idx" ON "web"."visits" USING btree ("occurred_at");