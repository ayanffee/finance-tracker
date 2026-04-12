-- Billing: subscriptions and AI usage tracking for Paystack integration

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro'
  "status" TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'cancelled' | 'past_due'
  "paystack_customer_code" VARCHAR(100),
  "paystack_subscription_code" VARCHAR(100),
  "paystack_email_token" VARCHAR(255),
  "currency" VARCHAR(3) DEFAULT 'NGN',
  "current_period_start" TIMESTAMP,
  "current_period_end" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");

CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,  -- 1-12
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_usage_user_month_idx" ON "ai_usage" ("user_id", "year", "month");
