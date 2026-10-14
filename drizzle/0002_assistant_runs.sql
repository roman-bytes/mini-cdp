CREATE SCHEMA "assistant";
--> statement-breakpoint
CREATE TABLE "assistant"."model_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"pii_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant"."runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"sent_question" text NOT NULL,
	"replacements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"answer" text,
	"outputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assistant"."model_calls" ADD CONSTRAINT "model_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "assistant"."runs"("id") ON DELETE cascade ON UPDATE no action;