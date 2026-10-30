CREATE TABLE IF NOT EXISTS `job_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_name` text NOT NULL,
	`job_title` text NOT NULL,
	`job_description` text DEFAULT '' NOT NULL,
	`source_url` text,
	`stage` text DEFAULT 'saved' NOT NULL,
	`result` text DEFAULT 'pending' NOT NULL,
	`resume_id` text,
	`jd_analysis_id` text,
	`interview_session_id` text,
	`applied_at` integer,
	`result_at` integer,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`jd_analysis_id`) REFERENCES `jd_analyses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`interview_session_id`) REFERENCES `interview_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `job_applications_user_updated_idx` ON `job_applications` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `job_applications_user_stage_result_idx` ON `job_applications` (`user_id`,`stage`,`result`);
