CREATE TABLE "interview_question_favorites" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bank_id" text NOT NULL,
	"question_id" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"metadata" text DEFAULT '{}',
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_question_practice_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bank_id" text NOT NULL,
	"question_id" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"is_correct" integer DEFAULT 0 NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"rubric_result" text DEFAULT '{}',
	"metadata" text DEFAULT '{}',
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_question_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bank_id" text NOT NULL,
	"question_id" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"wrong_count" integer DEFAULT 0 NOT NULL,
	"best_score" integer DEFAULT 0 NOT NULL,
	"last_score" integer DEFAULT 0 NOT NULL,
	"mastered" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" integer,
	"created_at" integer DEFAULT extract(epoch from now())::integer NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::integer NOT NULL
);
