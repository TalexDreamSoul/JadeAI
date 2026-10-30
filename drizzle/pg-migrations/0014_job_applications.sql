CREATE TABLE IF NOT EXISTS "job_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"job_title" text NOT NULL,
	"job_description" text DEFAULT '' NOT NULL,
	"source_url" text,
	"stage" text DEFAULT 'saved' NOT NULL,
	"result" text DEFAULT 'pending' NOT NULL,
	"resume_id" text,
	"jd_analysis_id" text,
	"interview_session_id" text,
	"applied_at" integer,
	"result_at" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	CONSTRAINT "job_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "job_applications_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "job_applications_jd_analysis_id_jd_analyses_id_fk" FOREIGN KEY ("jd_analysis_id") REFERENCES "public"."jd_analyses"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "job_applications_interview_session_id_interview_sessions_id_fk" FOREIGN KEY ("interview_session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_applications_user_updated_idx" ON "job_applications" USING btree ("user_id","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_applications_user_stage_result_idx" ON "job_applications" USING btree ("user_id","stage","result");
