import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Finance Tracker API", () => {
  describe("Categories", () => {
    it("should list user categories", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const categories = await caller.categories.list();
      expect(Array.isArray(categories)).toBe(true);
    });

    it("should create a new category", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.categories.create({
        name: "Groceries",
        type: "expense",
        color: "#ef4444",
        icon: "shopping-cart",
      });

      expect(result).toBeDefined();
    });
  });

  describe("Transactions", () => {
    it("should list user transactions", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const transactions = await caller.transactions.list();
      expect(Array.isArray(transactions)).toBe(true);
    });

    it("should create a transaction", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create category first
      await caller.categories.create({
        name: "Salary",
        type: "income",
      });

      const result = await caller.transactions.create({
        categoryId: 1,
        type: "income",
        amount: "5000",
        date: new Date(),
        description: "Monthly salary",
      });

      expect(result).toBeDefined();
    });

    it("should delete a transaction", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create a transaction
      await caller.categories.create({
        name: "Food",
        type: "expense",
      });

      await caller.transactions.create({
        categoryId: 1,
        type: "expense",
        amount: "25.50",
        date: new Date(),
        description: "Lunch",
      });

      // List to get ID
      const transactions = await caller.transactions.list();
      if (transactions.length > 0) {
        const result = await caller.transactions.delete({
          id: transactions[0].id,
        });
        expect(result).toBeDefined();
      }
    });
  });

  describe("Wishlist", () => {
    it("should list user wishlist items", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const wishlist = await caller.wishlist.list();
      expect(Array.isArray(wishlist)).toBe(true);
    });

    it("should create a wishlist item", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.wishlist.create({
        name: "New Laptop",
        estimatedPrice: "1500",
        priority: "high",
        description: "For work and gaming",
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      expect(result).toBeDefined();
    });

    it("should update a wishlist item", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create item
      await caller.wishlist.create({
        name: "Headphones",
        estimatedPrice: "200",
        priority: "medium",
      });

      // Get items
      const items = await caller.wishlist.list();
      if (items.length > 0) {
        const result = await caller.wishlist.update({
          id: items[0].id,
          priority: "high",
          purchased: true,
        });
        expect(result).toBeDefined();
      }
    });

    it("should delete a wishlist item", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create item
      await caller.wishlist.create({
        name: "Monitor",
        estimatedPrice: "400",
      });

      // Get items
      const items = await caller.wishlist.list();
      if (items.length > 0) {
        const result = await caller.wishlist.delete({
          id: items[0].id,
        });
        expect(result).toBeDefined();
      }
    });
  });

  describe("Financial Goals", () => {
    it("should list user financial goals", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const goals = await caller.goals.list();
      expect(Array.isArray(goals)).toBe(true);
    });

    it("should create a financial goal", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.goals.create({
        name: "Emergency Fund",
        targetAmount: "10000",
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        description: "Save 6 months of expenses",
      });

      expect(result).toBeDefined();
    });

    it("should update a financial goal", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create goal
      await caller.goals.create({
        name: "Vacation Fund",
        targetAmount: "5000",
        targetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });

      // Get goals
      const goals = await caller.goals.list();
      if (goals.length > 0) {
        const result = await caller.goals.update({
          id: goals[0].id,
          currentAmount: "2500",
        });
        expect(result).toBeDefined();
      }
    });

    it("should delete a financial goal", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create goal
      await caller.goals.create({
        name: "Car Fund",
        targetAmount: "25000",
        targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      // Get goals
      const goals = await caller.goals.list();
      if (goals.length > 0) {
        const result = await caller.goals.delete({
          id: goals[0].id,
        });
        expect(result).toBeDefined();
      }
    });
  });

  describe("Financial Calculations", () => {
    it("should calculate correct income and expenses", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      // Create categories
      await caller.categories.create({
        name: "Salary",
        type: "income",
      });

      await caller.categories.create({
        name: "Food",
        type: "expense",
      });

      // Create transactions
      await caller.transactions.create({
        categoryId: 1,
        type: "income",
        amount: "5000",
        date: new Date(),
      });

      await caller.transactions.create({
        categoryId: 2,
        type: "expense",
        amount: "500",
        date: new Date(),
      });

      const transactions = await caller.transactions.list();
      const income = transactions
        .filter(t => t.type === "income")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const expenses = transactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      expect(income).toBeGreaterThanOrEqual(5000);
      expect(expenses).toBeGreaterThanOrEqual(500);
    });
  });
});
