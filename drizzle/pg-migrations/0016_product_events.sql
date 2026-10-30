CREATE TABLE IF NOT EXISTS "product_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"user_id" text,
	"anonymous_id" text,
	"metadata" text DEFAULT '{}' NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	CONSTRAINT "product_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "product_events_actor_check" CHECK ("user_id" IS NOT NULL OR "anonymous_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_created_idx" ON "product_events" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_name_created_idx" ON "product_events" ("event_name","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_user_created_idx" ON "product_events" ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_anonymous_created_idx" ON "product_events" ("anonymous_id","created_at");
