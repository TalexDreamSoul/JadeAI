ALTER TABLE `jd_analyses` ADD `resume_version_id` text;--> statement-breakpoint
ALTER TABLE `jd_analyses` ADD `resume_version_label` text;--> statement-breakpoint
ALTER TABLE `jd_analyses` ADD `resume_title_snapshot` text;--> statement-breakpoint
ALTER TABLE `jd_analyses` ADD `target_company_snapshot` text;--> statement-breakpoint
ALTER TABLE `jd_analyses` ADD `target_job_title_snapshot` text;--> statement-breakpoint
ALTER TABLE `jd_analyses` ADD `jd_hash` text;--> statement-breakpoint
ALTER TABLE `jd_analyses` ADD `analysis_group_id` text;--> statement-breakpoint
CREATE TABLE `resume_change_proposals` (
  `id` text PRIMARY KEY NOT NULL,
  `resume_id` text NOT NULL,
  `user_id` text,
  `source` text DEFAULT 'ai' NOT NULL,
  `source_id` text,
  `share_id` text,
  `comment_id` text,
  `section_id` text,
  `section_type` text NOT NULL,
  `target_field` text DEFAULT 'text' NOT NULL,
  `current` text DEFAULT '' NOT NULL,
  `suggested` text DEFAULT '' NOT NULL,
  `reason` text DEFAULT '' NOT NULL,
  `evidence_required` integer DEFAULT false NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `metadata` text DEFAULT '{}',
  `before_version_id` text,
  `applied_version_id` text,
  `undo_content` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
