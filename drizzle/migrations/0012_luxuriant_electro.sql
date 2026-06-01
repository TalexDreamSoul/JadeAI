CREATE TABLE `ai_usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feature` text NOT NULL,
	`provider` text,
	`model` text,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`credits_charged` integer DEFAULT 0 NOT NULL,
	`wallet_transaction_id` text,
	`status` text DEFAULT 'success' NOT NULL,
	`error` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interview_question_banks` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`level` text DEFAULT 'mid' NOT NULL,
	`company_type` text DEFAULT '' NOT NULL,
	`access_level` text DEFAULT 'free' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interview_question_banks_key_unique` ON `interview_question_banks` (`key`);--> statement-breakpoint
CREATE TABLE `interview_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_id` text NOT NULL,
	`dimension` text DEFAULT 'general' NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`question_type` text DEFAULT 'open' NOT NULL,
	`prompt` text NOT NULL,
	`reference_answer` text DEFAULT '' NOT NULL,
	`rubric` text DEFAULT '{}' NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`follow_up_strategy` text DEFAULT '{}' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bank_id`) REFERENCES `interview_question_banks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lottery_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`rules` text DEFAULT '{}' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lottery_campaigns_key_unique` ON `lottery_campaigns` (`key`);--> statement-breakpoint
CREATE TABLE `lottery_draws` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`prize_type` text DEFAULT 'none' NOT NULL,
	`prize_payload` text DEFAULT '{}',
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `lottery_campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`tier` integer DEFAULT 0 NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`billing_cycle` text DEFAULT 'month' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_plans_key_unique` ON `membership_plans` (`key`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`action_url` text,
	`metadata` text DEFAULT '{}',
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_type` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`order_no` text NOT NULL,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`total_cents` integer DEFAULT 0 NOT NULL,
	`payable_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`metadata` text DEFAULT '{}',
	`paid_at` integer,
	`fulfilled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`provider` text DEFAULT 'mock' NOT NULL,
	`provider_trade_no` text,
	`status` text DEFAULT 'succeeded' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`raw_payload` text DEFAULT '{}',
	`paid_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plan_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`active` integer DEFAULT true NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `redeem_code_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`redeem_code_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'success' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`redeem_code_id`) REFERENCES `redeem_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `redeem_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'benefit' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`max_claims` integer DEFAULT 1 NOT NULL,
	`claimed_count` integer DEFAULT 0 NOT NULL,
	`benefit` text DEFAULT '{}' NOT NULL,
	`starts_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redeem_codes_code_unique` ON `redeem_codes` (`code`);--> statement-breakpoint
CREATE TABLE `referral_relations` (
	`id` text PRIMARY KEY NOT NULL,
	`inviter_user_id` text NOT NULL,
	`invitee_user_id` text NOT NULL,
	`campaign_key` text DEFAULT 'default' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reward_status` text DEFAULT 'pending' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inviter_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_entitlements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text DEFAULT '{}' NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`source` text DEFAULT 'system' NOT NULL,
	`source_id` text,
	`starts_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'system' NOT NULL,
	`source_id` text,
	`current_period_start` integer DEFAULT (unixepoch()) NOT NULL,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `membership_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wallet_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`currency` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`locked_balance` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `wallet_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`currency` text NOT NULL,
	`direction` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`source` text NOT NULL,
	`source_id` text,
	`description` text DEFAULT '' NOT NULL,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `wallet_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
