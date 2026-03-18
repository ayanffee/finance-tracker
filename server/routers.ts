import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  categories: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserCategories(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(['income', 'expense']),
        color: z.string().optional(),
        icon: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createCategory(ctx.user.id, input.name, input.type, input.color, input.icon)
      ),
  }),

  transactions: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserTransactions(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        type: z.enum(['income', 'expense']),
        amount: z.string(),
        date: z.date(),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createTransaction(ctx.user.id, input.categoryId, input.type, input.amount, input.date, input.description)
      ),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        categoryId: z.number().optional(),
        amount: z.string().optional(),
        date: z.date().optional(),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.updateTransaction(input.id, ctx.user.id, { ...input, id: undefined })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteTransaction(input.id, ctx.user.id)
      ),
  }),

  wishlist: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserWishlistItems(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        estimatedPrice: z.string(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        description: z.string().optional(),
        targetDate: z.date().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createWishlistItem(ctx.user.id, input.name, input.estimatedPrice, input.priority, input.description, input.targetDate)
      ),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        estimatedPrice: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high']).optional(),
        description: z.string().optional(),
        targetDate: z.date().optional(),
        purchased: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.updateWishlistItem(input.id, ctx.user.id, { ...input, id: undefined })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteWishlistItem(input.id, ctx.user.id)
      ),
  }),

  goals: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserFinancialGoals(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        targetAmount: z.string(),
        targetDate: z.date(),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createFinancialGoal(ctx.user.id, input.name, input.targetAmount, input.targetDate, input.description)
      ),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        currentAmount: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.updateFinancialGoal(input.id, ctx.user.id, { ...input, id: undefined })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteFinancialGoal(input.id, ctx.user.id)
      ),
  }),

  budgets: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserBudgets(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        monthlyLimit: z.string(),
        alertThreshold: z.number().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createBudget(ctx.user.id, input.categoryId, input.monthlyLimit, input.alertThreshold)
      ),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        monthlyLimit: z.string().optional(),
        alertThreshold: z.number().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.updateBudget(input.id, ctx.user.id, { ...input, id: undefined })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteBudget(input.id, ctx.user.id)
      ),
  }),

  recurring: router({
    list: protectedProcedure.query(({ ctx }) =>
      db.getUserRecurringTransactions(ctx.user.id)
    ),
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        type: z.enum(['income', 'expense']),
        amount: z.string(),
        frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
        nextOccurrence: z.date(),
        description: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createRecurringTransaction(ctx.user.id, input.categoryId, input.type, input.amount, input.frequency, input.nextOccurrence, input.description)
      ),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        active: z.boolean().optional(),
        nextOccurrence: z.date().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.updateRecurringTransaction(input.id, ctx.user.id, { ...input, id: undefined })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) =>
        db.deleteRecurringTransaction(input.id, ctx.user.id)
      ),
  }),
});

export type AppRouter = typeof appRouter;
