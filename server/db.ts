import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users, categories, transactions, wishlistItems,
  financialGoals, budgets, recurringTransactions,
  type InsertTransaction, type InsertWishlistItem,
  type InsertFinancialGoal, type InsertBudget, type InsertRecurringTransaction,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
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
