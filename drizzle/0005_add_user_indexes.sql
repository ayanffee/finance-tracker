-- Add indexes on user_id columns for scalability
-- Without these, every query is a full table scan at 1k+ users

CREATE INDEX IF NOT EXISTS "categories_user_id_idx" ON "categories" ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_user_id_idx" ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "transactions_user_id_date_idx" ON "transactions" ("user_id", "date" DESC);
CREATE INDEX IF NOT EXISTS "wishlist_items_user_id_idx" ON "wishlist_items" ("user_id");
CREATE INDEX IF NOT EXISTS "financial_goals_user_id_idx" ON "financial_goals" ("user_id");
CREATE INDEX IF NOT EXISTS "budgets_user_id_idx" ON "budgets" ("user_id");
CREATE INDEX IF NOT EXISTS "recurring_transactions_user_id_idx" ON "recurring_transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_conversations_user_id_idx" ON "ai_conversations" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "monthly_snapshots_user_id_idx" ON "monthly_snapshots" ("user_id", "year" DESC, "month" DESC);
CREATE INDEX IF NOT EXISTS "import_queue_user_id_status_idx" ON "import_queue" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "import_queue_user_id_ref_idx" ON "import_queue" ("user_id", "external_ref");
