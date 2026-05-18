CREATE TABLE `ai_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`api_key` text NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`openai_endpoint` text DEFAULT 'chat' NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_used_at` integer,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_node_id` text NOT NULL,
	`to_node_id` text NOT NULL,
	`relation` text DEFAULT 'related' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_node_id`) REFERENCES `knowledge_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_node_id`) REFERENCES `knowledge_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `knowledge_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resume_id` text,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resume_ai_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`resume_id` text NOT NULL,
	`user_id` text NOT NULL,
	`result` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resume_events` (
	`id` text PRIMARY KEY NOT NULL,
	`resume_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `resume_review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`share_id` text NOT NULL,
	`resume_id` text NOT NULL,
	`author_name` text DEFAULT 'Reviewer' NOT NULL,
	`author_email` text,
	`section_id` text,
	`content` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`share_id`) REFERENCES `resume_shares`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `resume_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`resume_id` text NOT NULL,
	`label` text NOT NULL,
	`snapshot` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `template_market_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`base_template` text DEFAULT 'touch-pure' NOT NULL,
	`theme_config` text DEFAULT '{}' NOT NULL,
	`custom_css` text DEFAULT '' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`install_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT '未命名简历' NOT NULL,
	`template` text DEFAULT 'touch-pure' NOT NULL,
	`theme_config` text DEFAULT '{}',
	`is_default` integer DEFAULT false NOT NULL,
	`is_base` integer DEFAULT false NOT NULL,
	`cloud_sync_enabled` integer DEFAULT true NOT NULL,
	`language` text DEFAULT 'zh' NOT NULL,
	`source_resume_id` text,
	`base_resume_id` text,
	`target_company` text,
	`target_job_title` text,
	`job_description` text,
	`version_label` text DEFAULT 'v1' NOT NULL,
	`share_token` text,
	`is_public` integer DEFAULT false NOT NULL,
	`share_password` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_resumes`("id", "user_id", "title", "template", "theme_config", "is_default", "is_base", "cloud_sync_enabled", "language", "source_resume_id", "base_resume_id", "target_company", "target_job_title", "job_description", "version_label", "share_token", "is_public", "share_password", "view_count", "created_at", "updated_at") SELECT "id", "user_id", "title", "template", "theme_config", "is_default", false, true, "language", NULL, NULL, NULL, NULL, NULL, 'v1', "share_token", "is_public", "share_password", "view_count", "created_at", "updated_at" FROM `resumes`;--> statement-breakpoint
DROP TABLE `resumes`;--> statement-breakpoint
ALTER TABLE `__new_resumes` RENAME TO `resumes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `resume_shares` ADD `review_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `resume_shares` ADD `download_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;
