CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`admin_user_id` text NOT NULL,
	`target_user_id` text,
	`action` text NOT NULL,
	`target_type` text DEFAULT 'user' NOT NULL,
	`before` text DEFAULT '{}',
	`after` text DEFAULT '{}',
	`reason` text DEFAULT '' NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`admin_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_audit_logs_admin_created_idx` ON `admin_audit_logs` (`admin_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `admin_audit_logs_target_created_idx` ON `admin_audit_logs` (`target_user_id`,`created_at`);
