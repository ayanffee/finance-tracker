import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, categories, transactions, wishlistItems, financialGoals, budgets, recurringTransactions, InsertTransaction, InsertWishlistItem, InsertFinancialGoal, InsertBudget, InsertRecurringTransaction } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== CATEGORY QUERIES =====
export async function getUserCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function createCategory(userId: number, name: string, type: 'income' | 'expense', color?: string, icon?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categories).values({
    userId,
    name,
    type,
    color: color || '#3b82f6',
    icon: icon || 'tag',
  });
  return result;
}

// ===== TRANSACTION QUERIES =====
export async function createTransaction(userId: number, categoryId: number, type: 'income' | 'expense', amount: string, date: Date, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(transactions).values({
    userId,
    categoryId,
    type,
    amount,
    date,
    description,
  });
}

export async function getUserTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId));
}

export async function getTransactionById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result.length > 0 && result[0].userId === userId ? result[0] : null;
}

export async function updateTransaction(id: number, userId: number, updates: Partial<InsertTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify ownership
  const existing = await getTransactionById(id, userId);
  if (!existing) throw new Error("Transaction not found");
  return db.update(transactions).set(updates).where(eq(transactions.id, id));
}

export async function deleteTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getTransactionById(id, userId);
  if (!existing) throw new Error("Transaction not found");
  return db.delete(transactions).where(eq(transactions.id, id));
}

// ===== WISHLIST QUERIES =====
export async function createWishlistItem(userId: number, name: string, estimatedPrice: string, priority: 'low' | 'medium' | 'high' = 'medium', description?: string, targetDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(wishlistItems).values({
    userId,
    name,
    estimatedPrice,
    priority,
    description,
    targetDate,
  });
}

export async function getUserWishlistItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId));
}

export async function getWishlistItemById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id)).limit(1);
  return result.length > 0 && result[0].userId === userId ? result[0] : null;
}

export async function updateWishlistItem(id: number, userId: number, updates: Partial<InsertWishlistItem>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getWishlistItemById(id, userId);
  if (!existing) throw new Error("Wishlist item not found");
  return db.update(wishlistItems).set(updates).where(eq(wishlistItems.id, id));
}

export async function deleteWishlistItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getWishlistItemById(id, userId);
  if (!existing) throw new Error("Wishlist item not found");
  return db.delete(wishlistItems).where(eq(wishlistItems.id, id));
}

// ===== FINANCIAL GOALS QUERIES =====
export async function createFinancialGoal(userId: number, name: string, targetAmount: string, targetDate: Date, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(financialGoals).values({
    userId,
    name,
    targetAmount,
    targetDate,
    description,
  });
}

export async function getUserFinancialGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialGoals).where(eq(financialGoals.userId, userId));
}

export async function getFinancialGoalById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(financialGoals).where(eq(financialGoals.id, id)).limit(1);
  return result.length > 0 && result[0].userId === userId ? result[0] : null;
}

export async function updateFinancialGoal(id: number, userId: number, updates: Partial<InsertFinancialGoal>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getFinancialGoalById(id, userId);
  if (!existing) throw new Error("Financial goal not found");
  return db.update(financialGoals).set(updates).where(eq(financialGoals.id, id));
}

export async function deleteFinancialGoal(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getFinancialGoalById(id, userId);
  if (!existing) throw new Error("Financial goal not found");
  return db.delete(financialGoals).where(eq(financialGoals.id, id));
}

// ===== BUDGET QUERIES =====
export async function createBudget(userId: number, categoryId: number, monthlyLimit: string, alertThreshold?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(budgets).values({
    userId,
    categoryId,
    monthlyLimit,
    alertThreshold: alertThreshold || 80,
  });
}

export async function getUserBudgets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(budgets).where(eq(budgets.userId, userId));
}

export async function getBudgetById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(budgets).where(eq(budgets.id, id)).limit(1);
  return result.length > 0 && result[0].userId === userId ? result[0] : null;
}

export async function updateBudget(id: number, userId: number, updates: Partial<InsertBudget>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getBudgetById(id, userId);
  if (!existing) throw new Error("Budget not found");
  return db.update(budgets).set(updates).where(eq(budgets.id, id));
}

export async function deleteBudget(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getBudgetById(id, userId);
  if (!existing) throw new Error("Budget not found");
  return db.delete(budgets).where(eq(budgets.id, id));
}

// ===== RECURRING TRANSACTION QUERIES =====
export async function createRecurringTransaction(userId: number, categoryId: number, type: 'income' | 'expense', amount: string, frequency: string, nextOccurrence: Date, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(recurringTransactions).values({
    userId,
    categoryId,
    type,
    amount,
    frequency: frequency as any,
    nextOccurrence,
    description,
  });
}

export async function getUserRecurringTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recurringTransactions).where(eq(recurringTransactions.userId, userId));
}

export async function getRecurringTransactionById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(recurringTransactions).where(eq(recurringTransactions.id, id)).limit(1);
  return result.length > 0 && result[0].userId === userId ? result[0] : null;
}

export async function updateRecurringTransaction(id: number, userId: number, updates: Partial<InsertRecurringTransaction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getRecurringTransactionById(id, userId);
  if (!existing) throw new Error("Recurring transaction not found");
  return db.update(recurringTransactions).set(updates).where(eq(recurringTransactions.id, id));
}

export async function deleteRecurringTransaction(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getRecurringTransactionById(id, userId);
  if (!existing) throw new Error("Recurring transaction not found");
  return db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
}
