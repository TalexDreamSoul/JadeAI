CREATE TABLE `user_profile_memories` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `type` text DEFAULT 'profile' NOT NULL,
  `title` text NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `source` text DEFAULT 'manual' NOT NULL,
  `confidence` integer DEFAULT 80 NOT NULL,
  `metadata` text DEFAULT '{}',
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
