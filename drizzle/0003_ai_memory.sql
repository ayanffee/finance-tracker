CREATE TABLE IF NOT EXISTS "ai_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monthly_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"total_income" numeric(12, 2) NOT NULL,
	"total_expenses" numeric(12, 2) NOT NULL,
	"savings_rate" numeric(5, 2) NOT NULL,
	"top_category" varchar(100),
	"goal_progress" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_idx" ON "ai_conversations" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monthly_snapshots_user_month_idx" ON "monthly_snapshots" ("user_id", "year", "month");
