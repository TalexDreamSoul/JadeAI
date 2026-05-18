ALTER TABLE "resume_shares" ADD COLUMN "view_requires_login" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_shares" ADD COLUMN "anonymous_share" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_shares" ADD COLUMN "hide_sensitive_info" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_review_comments" ADD COLUMN "author_user_id" text;--> statement-breakpoint
ALTER TABLE "resume_review_comments" ADD COLUMN "selected_text" text;--> statement-breakpoint
ALTER TABLE "resume_review_comments" ADD COLUMN "anchor" text;--> statement-breakpoint
CREATE TABLE "resume_review_presence" (
	"id" text PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"resume_id" text NOT NULL,
	"user_id" text NOT NULL,
	"reviewer_name" text DEFAULT 'Reviewer' NOT NULL,
	"reviewer_email" text,
	"reviewer_avatar_url" text,
	"cursor_x" integer DEFAULT 0 NOT NULL,
	"cursor_y" integer DEFAULT 0 NOT NULL,
	"color" text DEFAULT '#10b981' NOT NULL,
	"last_seen_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
