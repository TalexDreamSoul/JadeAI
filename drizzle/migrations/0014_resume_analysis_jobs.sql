CREATE TABLE `resume_analysis_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resume_id` text,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer DEFAULT 0 NOT NULL,
	`file_data` text NOT NULL,
	`template` text DEFAULT 'touch-pure' NOT NULL,
	`language` text DEFAULT 'zh' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`worker_id` text,
	`locked_at` integer,
	`last_heartbeat_at` integer,
	`next_run_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	`error_code` text,
	`error_message` text,
	`logs` text DEFAULT '[]' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resume_id`) REFERENCES `resumes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `resume_analysis_jobs_user_status_idx` ON `resume_analysis_jobs` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `resume_analysis_jobs_status_next_run_idx` ON `resume_analysis_jobs` (`status`,`next_run_at`);
--> statement-breakpoint
CREATE INDEX `resume_analysis_jobs_worker_idx` ON `resume_analysis_jobs` (`worker_id`);
