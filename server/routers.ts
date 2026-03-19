import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { hashPassword, verifyPassword, createSessionToken } from "./_core/sdk";
import { ENV } from "./_core/env";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";

const ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().min(1).max(100),
        password: z.string().min(8),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });

        const passwordHash = await hashPassword(input.password);
        const user = await db.createUser(input.email, input.name, passwordHash);

        const token = await createSessionToken(user.id, user.email);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });

        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });

        const token = await createSessionToken(user.id, user.email);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        await db.updateLastSignedIn(user.id);

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }),
  }),

  categories: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserCategories(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        type: z.enum(["income", "expense"]),
        color: z.string().optional(),
        icon: z.string().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.createCategory(ctx.user.id, input.name, input.type, input.color, input.icon)
      ),
  }),

  transactions: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserTransactions(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        type: z.enum(["income", "expense"]),
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
      .mutation(({ ctx, input }) => db.deleteTransaction(input.id, ctx.user.id)),
    importCsv: protectedProcedure
      .input(z.object({
        rows: z.array(z.object({
          categoryId: z.number(),
          type: z.enum(["income", "expense"]),
          amount: z.string(),
          date: z.date(),
          description: z.string().optional(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = await Promise.allSettled(
          input.rows.map(row =>
            db.createTransaction(ctx.user.id, row.categoryId, row.type, row.amount, row.date, row.description)
          )
        );
        const succeeded = results.filter(r => r.status === "fulfilled").length;
        return { imported: succeeded, total: input.rows.length };
      }),
  }),

  wishlist: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserWishlistItems(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        estimatedPrice: z.string(),
        priority: z.enum(["low", "medium", "high"]).optional(),
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
        priority: z.enum(["low", "medium", "high"]).optional(),
        description: z.string().optional(),
        targetDate: z.date().optional(),
        purchased: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) =>
        db.updateWishlistItem(input.id, ctx.user.id, { ...input, id: undefined })
      ),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => db.deleteWishlistItem(input.id, ctx.user.id)),
  }),

  goals: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserFinancialGoals(ctx.user.id)),
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
      .mutation(({ ctx, input }) => db.deleteFinancialGoal(input.id, ctx.user.id)),
  }),

  budgets: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserBudgets(ctx.user.id)),
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
      .mutation(({ ctx, input }) => db.deleteBudget(input.id, ctx.user.id)),
  }),

  recurring: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserRecurringTransactions(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        categoryId: z.number(),
        type: z.enum(["income", "expense"]),
        amount: z.string(),
        frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
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
      .mutation(({ ctx, input }) => db.deleteRecurringTransaction(input.id, ctx.user.id)),
  }),

  assistant: router({
    chat: protectedProcedure
      .input(z.object({
        message: z.string(),
        financialContext: z.string(),
      }))
      .mutation(async ({ input }) => {
        if (!ENV.anthropicApiKey) {
          return { content: "AI assistant requires an ANTHROPIC_API_KEY to be configured in environment variables." };
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": ENV.anthropicApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            system: `You are a friendly and helpful personal finance assistant. You help users understand their spending, budgets, and financial health. Keep responses concise and actionable. Use markdown for formatting.`,
            messages: [
              {
                role: "user",
                content: `${input.financialContext}\n\nUser question: ${input.message}`,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI service unavailable" });
        }

        const data = await response.json() as any;
        return { content: data.content[0]?.text ?? "Sorry, I could not generate a response." };
      }),
  }),
});

export type AppRouter = typeof appRouter;
