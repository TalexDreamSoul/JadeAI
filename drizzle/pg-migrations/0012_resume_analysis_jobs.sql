CREATE TABLE IF NOT EXISTS "resume_analysis_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"resume_id" text REFERENCES "resumes"("id") ON DELETE SET NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"file_data" text NOT NULL,
	"template" text DEFAULT 'touch-pure' NOT NULL,
	"language" text DEFAULT 'zh' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"worker_id" text,
	"locked_at" integer,
	"last_heartbeat_at" integer,
	"next_run_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"started_at" integer,
	"finished_at" integer,
	"error_code" text,
	"error_message" text,
	"logs" text DEFAULT '[]' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_analysis_jobs_user_status_idx" ON "resume_analysis_jobs" ("user_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_analysis_jobs_status_next_run_idx" ON "resume_analysis_jobs" ("status","next_run_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_analysis_jobs_worker_idx" ON "resume_analysis_jobs" ("worker_id");
