CREATE TABLE IF NOT EXISTS "auth_login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"reset_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_login_attempts_reset_idx" ON "auth_login_attempts" ("reset_at");
