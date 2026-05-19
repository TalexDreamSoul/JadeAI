CREATE TABLE `job_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL,
  `role_key` text NOT NULL,
  `title` text NOT NULL,
  `level` text DEFAULT 'mid' NOT NULL,
  `industry` text DEFAULT '' NOT NULL,
  `jd` text DEFAULT '' NOT NULL,
  `keywords` text DEFAULT '[]' NOT NULL,
  `interview_questions` text DEFAULT '[]' NOT NULL,
  `recommended_sections` text DEFAULT '[]' NOT NULL,
  `enabled` integer DEFAULT true NOT NULL,
  `sort_order` integer DEFAULT 1000 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_templates_role_key_unique` ON `job_templates` (`role_key`);
