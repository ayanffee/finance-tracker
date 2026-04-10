CREATE TABLE IF NOT EXISTS "oauth_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" varchar(50) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expiry" timestamp,
	"provider_email" varchar(320),
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "import_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"source" varchar(20) NOT NULL,
	"external_ref" varchar(255),
	"amount" numeric(12, 2) NOT NULL,
	"transaction_type" text NOT NULL,
	"description" text,
	"transaction_date" timestamp NOT NULL,
	"suggested_category" varchar(100),
	"original_text" text,
	"confidence" numeric(3, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_tokens_user_provider_idx" ON "oauth_tokens" ("user_id", "provider");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "import_queue_dedup_idx" ON "import_queue" ("user_id", "external_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_queue_user_status_idx" ON "import_queue" ("user_id", "status");
