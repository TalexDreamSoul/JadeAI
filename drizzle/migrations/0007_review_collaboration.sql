ALTER TABLE `resume_shares` ADD `view_requires_login` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_shares` ADD `anonymous_share` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_shares` ADD `hide_sensitive_info` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_review_comments` ADD `author_user_id` text;--> statement-breakpoint
ALTER TABLE `resume_review_comments` ADD `selected_text` text;--> statement-breakpoint
ALTER TABLE `resume_review_comments` ADD `anchor` text;--> statement-breakpoint
CREATE TABLE `resume_review_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`resume_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reviewer_name` text DEFAULT 'Reviewer' NOT NULL,
	`reviewer_email` text,
	`reviewer_avatar_url` text,
	`cursor_x` integer DEFAULT 0 NOT NULL,
	`cursor_y` integer DEFAULT 0 NOT NULL,
	`color` text DEFAULT '#10b981' NOT NULL,
	`last_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `resume_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
