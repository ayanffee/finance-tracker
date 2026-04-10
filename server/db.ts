import { eq, and, desc, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users, categories, transactions, wishlistItems,
  financialGoals, budgets, recurringTransactions,
  aiConversations, monthlySnapshots,
  oauthTokens, importQueue,
  type InsertTransaction, type InsertWishlistItem,
  type InsertFinancialGoal, type InsertBudget, type InsertRecurringTransaction,
  type InsertAiConversation, type InsertMonthlySnapshot,
  type InsertOauthToken, type InsertImportQueueItem,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, {
        ssl: "require",
        max: 10,          // 10 connections per serverless instance
        idle_timeout: 20, // release idle connections after 20s
        connect_timeout: 10,
        prepare: false,   // required for PgBouncer / Neon pooler compatibility
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== USER AUTH =====
export async function createUser(email: string, name: string, passwordHash: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(users).values({ email, name, passwordHash }).returning();
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function updateLastSignedIn(id: number) {
  const db = getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
}

// ===== CATEGORY QUERIES =====
export async function getUserCategories(userId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function createCategory(userId: number, name: string, type: "income" | "expense", color?: string, icon?: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values({
    userId, name, type,
    color: color || "#3b82f6",
    icon: icon || "tag",
  }).returning();
  return result[0];
}

// ===== TRANSACTION QUERIES =====
export async function createTransaction(userId: number, categoryId: number, type: "income" | "expense", amount: string, date: Date, description?: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values({ userId, categoryId, type, amount, date, description }).returning();
  return result[0];
}

export async function getUserTransactions(userId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId));
}

export async function getTransactionById(id: number, userId: number) {
  const db = getDb();
  if (!db) return null;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result[0]?.userId === userId ? result[0] : null;
}

export async function updateTransaction(id: number, userId: number, updates: Partial<InsertTransaction>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getTransactionById(id, userId);
  if (!existing) throw new Error("Transaction not found");
  return db.update(transactions).set({ ...updates, updatedAt: new Date() }).where(eq(transactions.id, id));
}

export async function deleteTransaction(id: number, userId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getTransactionById(id, userId);
  if (!existing) throw new Error("Transaction not found");
  return db.delete(transactions).where(eq(transactions.id, id));
}

// ===== WISHLIST QUERIES =====
export async function createWishlistItem(userId: number, name: string, estimatedPrice: string, priority: "low" | "medium" | "high" = "medium", description?: string, targetDate?: Date) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(wishlistItems).values({ userId, name, estimatedPrice, priority, description, targetDate }).returning();
  return result[0];
}

export async function getUserWishlistItems(userId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId));
}

export async function getWishlistItemById(id: number, userId: number) {
  const db = getDb();
  if (!db) return null;
  const result = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).limit(1);
  return result[0]?.userId === userId ? result[0] : null;
}

export async function updateWishlistItem(id: number, userId: number, updates: Partial<InsertWishlistItem>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getWishlistItemById(id, userId);
  if (!existing) throw new Error("Wishlist item not found");
  return db.update(wishlistItems).set({ ...updates, updatedAt: new Date() }).where(eq(wishlistItems.id, id));
}

export async function deleteWishlistItem(id: number, userId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getWishlistItemById(id, userId);
  if (!existing) throw new Error("Wishlist item not found");
  return db.delete(wishlistItems).where(eq(wishlistItems.id, id));
}

// ===== FINANCIAL GOALS QUERIES =====
export async function createFinancialGoal(userId: number, name: string, targetAmount: string, targetDate: Date, description?: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(financialGoals).values({ userId, name, targetAmount, targetDate, description }).returning();
  return result[0];
}

export async function getUserFinancialGoals(userId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(financialGoals).where(eq(financialGoals.userId, userId));
}

export async function getFinancialGoalById(id: number, userId: number) {
  const db = getDb();
  if (!db) return null;
  const result = await db.select().from(financialGoals).where(eq(financialGoals.id, id)).limit(1);
  return result[0]?.userId === userId ? result[0] : null;
}

export async function updateFinancialGoal(id: number, userId: number, updates: Partial<InsertFinancialGoal>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getFinancialGoalById(id, userId);
  if (!existing) throw new Error("Financial goal not found");
  return db.update(financialGoals).set({ ...updates, updatedAt: new Date() }).where(eq(financialGoals.id, id));
}

export async function deleteFinancialGoal(id: number, userId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getFinancialGoalById(id, userId);
  if (!existing) throw new Error("Financial goal not found");
  return db.delete(financialGoals).where(eq(financialGoals.id, id));
}

// ===== BUDGET QUERIES =====
export async function createBudget(userId: number, categoryId: number, monthlyLimit: string, alertThreshold?: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(budgets).values({ userId, categoryId, monthlyLimit, alertThreshold: alertThreshold || 80 }).returning();
  return result[0];
}

export async function getUserBudgets(userId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(budgets).where(eq(budgets.userId, userId));
}

export async function getBudgetById(id: number, userId: number) {
  const db = getDb();
  if (!db) return null;
  const result = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
  return result[0]?.userId === userId ? result[0] : null;
}

export async function updateBudget(id: number, userId: number, updates: Partial<InsertBudget>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getBudgetById(id, userId);
  if (!existing) throw new Error("Budget not found");
  return db.update(budgets).set({ ...updates, updatedAt: new Date() }).where(eq(budgets.id, id));
}

export async function deleteBudget(id: number, userId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getBudgetById(id, userId);
  if (!existing) throw new Error("Budget not found");
  return db.delete(budgets).where(eq(budgets.id, id));
}

// ===== RECURRING TRANSACTION QUERIES =====
export async function createRecurringTransaction(userId: number, categoryId: number, type: "income" | "expense", amount: string, frequency: string, nextOccurrence: Date, description?: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recurringTransactions).values({
    userId, categoryId, type, amount, frequency: frequency as any, nextOccurrence, description,
  }).returning();
  return result[0];
}

export async function getUserRecurringTransactions(userId: number) {
  const db = getDb();
  if (!db) return [];
  return db.select().from(recurringTransactions).where(eq(recurringTransactions.userId, userId));
}

export async function getRecurringTransactionById(id: number, userId: number) {
  const db = getDb();
  if (!db) return null;
  const result = await db.select().from(recurringTransactions).where(eq(recurringTransactions.id, id)).limit(1);
  return result[0]?.userId === userId ? result[0] : null;
}

export async function updateRecurringTransaction(id: number, userId: number, updates: Partial<InsertRecurringTransaction>) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getRecurringTransactionById(id, userId);
  if (!existing) throw new Error("Recurring transaction not found");
  return db.update(recurringTransactions).set({ ...updates, updatedAt: new Date() }).where(eq(recurringTransactions.id, id));
}

export async function deleteRecurringTransaction(id: number, userId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getRecurringTransactionById(id, userId);
  if (!existing) throw new Error("Recurring transaction not found");
  return db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
}

// ===== AI CONVERSATION HISTORY =====
export async function appendConversationMessage(userId: number, role: "user" | "assistant", content: string) {
  const db = getDb();
  if (!db) return;
  await db.insert(aiConversations).values({ userId, role, content });
}

export async function getRecentConversation(userId: number, limit = 20) {
  const db = getDb();
  if (!db) return [];
  // Fetch last N messages ordered oldest-first for chronological context
  const rows = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function getConversationHistory(userId: number, limit = 50) {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, userId))
    .orderBy(desc(aiConversations.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function clearConversationHistory(userId: number) {
  const db = getDb();
  if (!db) return;
  await db.delete(aiConversations).where(eq(aiConversations.userId, userId));
}

// ===== MONTHLY SNAPSHOTS =====
export async function upsertMonthlySnapshot(userId: number, year: number, month: number, data: Omit<InsertMonthlySnapshot, "userId" | "year" | "month">) {
  const db = getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(monthlySnapshots)
    .where(and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.year, year), eq(monthlySnapshots.month, month)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(monthlySnapshots)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(monthlySnapshots.id, existing[0].id));
  } else {
    await db.insert(monthlySnapshots).values({ userId, year, month, ...data });
  }
}

export async function getMonthlySnapshots(userId: number, limitMonths = 6) {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(monthlySnapshots)
    .where(eq(monthlySnapshots.userId, userId))
    .orderBy(desc(monthlySnapshots.year), desc(monthlySnapshots.month))
    .limit(limitMonths);
  return rows.reverse(); // oldest first for charting
}

// ===== OAUTH TOKENS =====
export async function upsertOauthToken(userId: number, provider: string, data: Omit<InsertOauthToken, "userId" | "provider">) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(oauthTokens).set({ ...data, updatedAt: new Date() }).where(eq(oauthTokens.id, existing[0].id));
  } else {
    await db.insert(oauthTokens).values({ userId, provider, ...data });
  }
}

export async function getOauthToken(userId: number, provider: string) {
  const db = getDb();
  if (!db) return null;
  const rows = await db.select().from(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteOauthToken(userId: number, provider: string) {
  const db = getDb();
  if (!db) return;
  await db.delete(oauthTokens)
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)));
}

export async function getAllConnectedGmailUsers() {
  const db = getDb();
  if (!db) return [];
  return db.select().from(oauthTokens).where(eq(oauthTokens.provider, "gmail"));
}

export async function updateLastScanned(userId: number, provider: string) {
  const db = getDb();
  if (!db) return;
  await db.update(oauthTokens)
    .set({ lastScannedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider)));
}

// ===== IMPORT QUEUE =====
export async function getImportQueue(userId: number, status: "pending" | "approved" | "dismissed" = "pending") {
  const db = getDb();
  if (!db) return [];
  return db.select().from(importQueue)
    .where(and(eq(importQueue.userId, userId), eq(importQueue.status, status)))
    .orderBy(desc(importQueue.createdAt));
}

export async function isAlreadyQueued(userId: number, externalRef: string) {
  const db = getDb();
  if (!db) return false;
  const rows = await db.select({ id: importQueue.id }).from(importQueue)
    .where(and(eq(importQueue.userId, userId), eq(importQueue.externalRef, externalRef)))
    .limit(1);
  return rows.length > 0;
}

export async function addToImportQueue(item: InsertImportQueueItem) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(importQueue).values(item).returning();
  return result[0];
}

export async function updateImportQueueStatus(id: number, userId: number, status: "approved" | "dismissed") {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.update(importQueue).set({ status }).where(and(eq(importQueue.id, id), eq(importQueue.userId, userId)));
}

export async function updateAllImportQueueStatus(userId: number, status: "approved" | "dismissed") {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  await db.update(importQueue).set({ status })
    .where(and(eq(importQueue.userId, userId), eq(importQueue.status, "pending")));
}

export async function getPendingQueueCount(userId: number) {
  const db = getDb();
  if (!db) return 0;
  const rows = await db.select({ id: importQueue.id }).from(importQueue)
    .where(and(eq(importQueue.userId, userId), eq(importQueue.status, "pending")));
  return rows.length;
}
