CREATE TABLE "ai_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"api_key" text NOT NULL,
	"base_url" text NOT NULL,
	"model" text NOT NULL,
	"openai_endpoint" text DEFAULT 'chat' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"last_used_at" integer,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_node_id" text NOT NULL,
	"to_node_id" text NOT NULL,
	"relation" text DEFAULT 'related' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resume_id" text,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_ai_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"user_id" text NOT NULL,
	"result" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_events" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_review_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"resume_id" text NOT NULL,
	"author_name" text DEFAULT 'Reviewer' NOT NULL,
	"author_email" text,
	"section_id" text,
	"content" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"label" text NOT NULL,
	"snapshot" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_market_items" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_template" text DEFAULT 'touch-pure' NOT NULL,
	"theme_config" text DEFAULT '{}' NOT NULL,
	"custom_css" text DEFAULT '' NOT NULL,
	"is_public" integer DEFAULT 0 NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resumes" ALTER COLUMN "template" SET DEFAULT 'touch-pure';--> statement-breakpoint
ALTER TABLE "resume_shares" ADD COLUMN "review_enabled" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_shares" ADD COLUMN "download_enabled" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "is_base" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "cloud_sync_enabled" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "source_resume_id" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "base_resume_id" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "target_company" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "target_job_title" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "job_description" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "version_label" text DEFAULT 'v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;