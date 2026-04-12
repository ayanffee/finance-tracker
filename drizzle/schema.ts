import { serial, pgTable, text, timestamp, varchar, boolean, numeric, integer, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"user" | "admin">().default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).default("#3b82f6").notNull(),
  icon: varchar("icon", { length: 50 }).default("tag").notNull(),
  type: text("type").$type<"income" | "expense">().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("categories_user_id_idx").on(table.userId),
]);

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  categoryId: integer("category_id").notNull(),
  type: text("type").$type<"income" | "expense">().notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("transactions_user_id_idx").on(table.userId),
  index("transactions_user_id_date_idx").on(table.userId, table.date),
]);

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

export const wishlistItems = pgTable("wishlist_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  estimatedPrice: numeric("estimated_price", { precision: 12, scale: 2 }).notNull(),
  priority: text("priority").$type<"low" | "medium" | "high">().default("medium").notNull(),
  targetDate: timestamp("target_date"),
  purchased: boolean("purchased").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("wishlist_items_user_id_idx").on(table.userId),
]);

export type WishlistItem = typeof wishlistItems.$inferSelect;
export type InsertWishlistItem = typeof wishlistItems.$inferInsert;

export const financialGoals = pgTable("financial_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  targetDate: timestamp("target_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("financial_goals_user_id_idx").on(table.userId),
]);

export type FinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = typeof financialGoals.$inferInsert;

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  categoryId: integer("category_id").notNull(),
  monthlyLimit: numeric("monthly_limit", { precision: 12, scale: 2 }).notNull(),
  alertThreshold: integer("alert_threshold").default(80).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("budgets_user_id_idx").on(table.userId),
]);

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

export const recurringTransactions = pgTable("recurring_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  categoryId: integer("category_id").notNull(),
  type: text("type").$type<"income" | "expense">().notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  frequency: text("frequency").$type<"daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly">().notNull(),
  nextOccurrence: timestamp("next_occurrence").notNull(),
  lastOccurrence: timestamp("last_occurrence"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("recurring_transactions_user_id_idx").on(table.userId),
]);

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type InsertRecurringTransaction = typeof recurringTransactions.$inferInsert;

export const aiConversations = pgTable("ai_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  role: text("role").$type<"user" | "assistant">().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ai_conversations_user_id_idx").on(table.userId, table.createdAt),
]);

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;

export const monthlySnapshots = pgTable("monthly_snapshots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  totalIncome: numeric("total_income", { precision: 12, scale: 2 }).notNull(),
  totalExpenses: numeric("total_expenses", { precision: 12, scale: 2 }).notNull(),
  savingsRate: numeric("savings_rate", { precision: 5, scale: 2 }).notNull(), // percentage 0-100
  topCategory: varchar("top_category", { length: 100 }),
  goalProgress: text("goal_progress"), // JSON string: [{name, pct}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("monthly_snapshots_user_id_idx").on(table.userId, table.year, table.month),
]);

export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;
export type InsertMonthlySnapshot = typeof monthlySnapshots.$inferInsert;

// Stores Gmail / future OAuth tokens per user per provider
export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // "gmail"
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  providerEmail: varchar("provider_email", { length: 320 }),
  lastScannedAt: timestamp("last_scanned_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OauthToken = typeof oauthTokens.$inferSelect;
export type InsertOauthToken = typeof oauthTokens.$inferInsert;

// AI-parsed transactions awaiting user review before being committed
export const importQueue = pgTable("import_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  source: varchar("source", { length: 20 }).notNull(), // "gmail" | "sms"
  externalRef: varchar("external_ref", { length: 255 }), // Gmail message ID or SMS hash — for dedup
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionType: text("transaction_type").$type<"income" | "expense">().notNull(),
  description: text("description"),
  transactionDate: timestamp("transaction_date").notNull(),
  suggestedCategory: varchar("suggested_category", { length: 100 }),
  originalText: text("original_text"), // truncated source text for display
  confidence: numeric("confidence", { precision: 3, scale: 2 }), // 0.00–1.00
  status: text("status").$type<"pending" | "approved" | "dismissed">().default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("import_queue_user_id_status_idx").on(table.userId, table.status),
  index("import_queue_user_id_ref_idx").on(table.userId, table.externalRef),
]);

export type ImportQueueItem = typeof importQueue.$inferSelect;
export type InsertImportQueueItem = typeof importQueue.$inferInsert;

// ===== BILLING =====
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  plan: text("plan").$type<"free" | "pro">().default("free").notNull(),
  status: text("status").$type<"active" | "cancelled" | "past_due">().default("active").notNull(),
  paystackCustomerCode: varchar("paystack_customer_code", { length: 100 }),
  paystackSubscriptionCode: varchar("paystack_subscription_code", { length: 100 }),
  paystackEmailToken: varchar("paystack_email_token", { length: 255 }),
  currency: varchar("currency", { length: 3 }).default("NGN"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("subscriptions_user_id_idx").on(table.userId),
]);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export const aiUsage = pgTable("ai_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  messageCount: integer("message_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("ai_usage_user_month_idx").on(table.userId, table.year, table.month),
]);

export type AiUsage = typeof aiUsage.$inferSelect;
export type InsertAiUsage = typeof aiUsage.$inferInsert;
