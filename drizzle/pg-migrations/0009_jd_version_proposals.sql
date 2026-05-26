ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "resume_version_id" text;--> statement-breakpoint
ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "resume_version_label" text;--> statement-breakpoint
ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "resume_title_snapshot" text;--> statement-breakpoint
ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "target_company_snapshot" text;--> statement-breakpoint
ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "target_job_title_snapshot" text;--> statement-breakpoint
ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "jd_hash" text;--> statement-breakpoint
ALTER TABLE "jd_analyses" ADD COLUMN IF NOT EXISTS "analysis_group_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_change_proposals" (
  "id" text PRIMARY KEY NOT NULL,
  "resume_id" text NOT NULL REFERENCES "resumes"("id") ON DELETE cascade,
  "user_id" text REFERENCES "users"("id"),
  "source" text DEFAULT 'ai' NOT NULL,
  "source_id" text,
  "share_id" text,
  "comment_id" text,
  "section_id" text,
  "section_type" text NOT NULL,
  "target_field" text DEFAULT 'text' NOT NULL,
  "current" text DEFAULT '' NOT NULL,
  "suggested" text DEFAULT '' NOT NULL,
  "reason" text DEFAULT '' NOT NULL,
  "evidence_required" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "metadata" text DEFAULT '{}',
  "before_version_id" text,
  "applied_version_id" text,
  "undo_content" text,
  "created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
  "updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
