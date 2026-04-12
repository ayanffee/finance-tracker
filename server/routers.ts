import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { hashPassword, verifyPassword, createSessionToken } from "./_core/sdk";
import { buildOAuthState } from "./_core/oauth";
import { ENV } from "./_core/env";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import {
  buildGmailAuthUrl,
  fetchFinancialEmails,
  parseEmailForTransaction,
  refreshAccessToken,
} from "./gmail";
import {
  initializeTransaction,
  verifyTransaction,
  disableSubscription,
  verifyWebhookSignature,
  PLANS,
  FREE_AI_LIMIT,
  PRO_AI_LIMIT,
} from "./paystack";

const SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 7; // 7 days

// ── AI helpers ────────────────────────────────────────────────────────────────

async function callClaude(
  apiKey: string,
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 1024,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI service unavailable" });
  }

  const data = await response.json() as any;
  return data.content[0]?.text ?? "Sorry, I could not generate a response.";
}

// Convenience wrapper for single-turn calls (no history needed)
async function callClaudeSingle(apiKey: string, system: string, userMessage: string, maxTokens = 1024): Promise<string> {
  return callClaude(apiKey, system, [{ role: "user", content: userMessage }], maxTokens);
}

function buildSnapshotContext(snapshots: any[]): string {
  if (snapshots.length === 0) return "";
  const lines = snapshots.map((s: any) => {
    const monthName = new Date(s.year, s.month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
    const net = (parseFloat(s.totalIncome) - parseFloat(s.totalExpenses)).toFixed(2);
    const rate = parseFloat(s.savingsRate).toFixed(1);
    return `  ${monthName}: income $${parseFloat(s.totalIncome).toFixed(2)}, expenses $${parseFloat(s.totalExpenses).toFixed(2)}, net $${net}, savings rate ${rate}%${s.topCategory ? `, top spend: ${s.topCategory}` : ""}`;
  });
  return `\nMONTHLY HISTORY (last ${snapshots.length} months):\n${lines.join("\n")}`;
}

function monthlyEquivalent(amount: number, frequency: string): number {
  switch (frequency) {
    case "daily": return amount * 30;
    case "weekly": return amount * 4.33;
    case "biweekly": return amount * 2.17;
    case "monthly": return amount;
    case "quarterly": return amount / 3;
    case "yearly": return amount / 12;
    default: return amount;
  }
}

function buildFinancialContext(data: {
  transactions: any[];
  goals: any[];
  budgets: any[];
  categories: any[];
  wishlist: any[];
  recurring: any[];
  totals?: { totalIncome: number; totalExpenses: number; count: number };
}): string {
  const { transactions, goals, budgets, categories, wishlist, recurring, totals } = data;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const categoryMap: Record<number, string> = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

  // Transaction stats — use pre-aggregated totals if available (scalable), else compute from rows
  const totalIncome = totals?.totalIncome ?? transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
  const totalExpenses = totals?.totalExpenses ?? transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
  const recentTx = transactions.filter((t: any) => new Date(t.date) > thirtyDaysAgo);
  const recentIncome = recentTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
  const recentExpenses = recentTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);

  // Category spending
  const expByCategory = transactions.filter((t: any) => t.type === "expense").reduce((acc: Record<string, number>, t: any) => {
    const name = categoryMap[t.categoryId] ?? "Unknown";
    acc[name] = (acc[name] || 0) + parseFloat(t.amount);
    return acc;
  }, {});
  const topCategories = Object.entries(expByCategory).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5);

  // Goals with on-track analysis
  const goalsText = goals.length > 0 ? goals.map((g: any) => {
    const current = parseFloat(g.currentAmount ?? "0");
    const target = parseFloat(g.targetAmount);
    const remaining = target - current;
    const daysLeft = Math.ceil((new Date(g.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const monthsLeft = Math.max(daysLeft / 30, 0);
    const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;
    const pct = ((current / target) * 100).toFixed(0);
    return `  - ${g.name}: $${current.toFixed(2)}/$${target.toFixed(2)} (${pct}%), target ${new Date(g.targetDate).toLocaleDateString()}, needs $${monthlyNeeded.toFixed(2)}/mo to reach on time`;
  }).join("\n") : "  None set";

  // Budget status this month
  const spentThisMonth = transactions.filter((t: any) => new Date(t.date) >= thisMonthStart && t.type === "expense")
    .reduce((acc: Record<number, number>, t: any) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const budgetsText = budgets.length > 0 ? budgets.map((b: any) => {
    const spent = spentThisMonth[b.categoryId] || 0;
    const limit = parseFloat(b.monthlyLimit);
    const pct = ((spent / limit) * 100).toFixed(0);
    const status = spent > limit ? "OVER BUDGET" : spent / limit > (b.alertThreshold || 80) / 100 ? "NEAR LIMIT" : "OK";
    return `  - ${categoryMap[b.categoryId] ?? "Unknown"}: $${spent.toFixed(2)}/$${limit.toFixed(2)} (${pct}%) [${status}]`;
  }).join("\n") : "  None set";

  // Recurring — project next month
  const activeRecurring = recurring.filter((r: any) => r.active !== false);
  const committedExpenses = activeRecurring.filter((r: any) => r.type === "expense")
    .reduce((s: number, r: any) => s + monthlyEquivalent(parseFloat(r.amount), r.frequency), 0);
  const committedIncome = activeRecurring.filter((r: any) => r.type === "income")
    .reduce((s: number, r: any) => s + monthlyEquivalent(parseFloat(r.amount), r.frequency), 0);

  const recurringText = activeRecurring.length > 0
    ? activeRecurring.map((r: any) =>
        `  - ${r.description ?? "Unnamed"}: ${r.type === "income" ? "+" : "-"}$${parseFloat(r.amount).toFixed(2)}/${r.frequency}`
      ).join("\n")
    : "  None";

  // Wishlist
  const unpurchased = wishlist.filter((w: any) => !w.purchased);
  const wishlistText = unpurchased.length > 0
    ? unpurchased.map((w: any) =>
        `  - ${w.name}: $${parseFloat(w.estimatedPrice).toFixed(2)} (${w.priority ?? "medium"} priority)`
      ).join("\n")
    : "  None";

  return `=== FINANCIAL PROFILE (${now.toLocaleDateString()}) ===

OVERVIEW:
  All-time income:  $${totalIncome.toFixed(2)}
  All-time expenses: $${totalExpenses.toFixed(2)}
  Net balance:      $${(totalIncome - totalExpenses).toFixed(2)}
  Last 30d income:  $${recentIncome.toFixed(2)}
  Last 30d expenses: $${recentExpenses.toFixed(2)}
  Last 30d net:     $${(recentIncome - recentExpenses).toFixed(2)}

TOP SPENDING CATEGORIES (all time):
${topCategories.map(([name, amt]) => `  - ${name}: $${(amt as number).toFixed(2)}`).join("\n") || "  No expense data yet"}

FINANCIAL GOALS:
${goalsText}

BUDGET STATUS (this month):
${budgetsText}

RECURRING TRANSACTIONS:
${recurringText}
  → Projected monthly committed expenses: $${committedExpenses.toFixed(2)}
  → Projected monthly recurring income:   $${committedIncome.toFixed(2)}
  → Projected monthly surplus:            $${(committedIncome - committedExpenses).toFixed(2)}

WISHLIST:
${wishlistText}`;
}

// ── Billing helpers ──────────────────────────────────────────────────────────

async function checkAiLimit(userId: number): Promise<{ allowed: boolean; plan: string; used: number; limit: number }> {
  const sub = await db.getUserSubscription(userId);
  const plan = sub?.plan === "pro" && sub.status === "active" ? "pro" : "free";
  const limit = plan === "pro" ? PRO_AI_LIMIT : FREE_AI_LIMIT;
  const used = await db.getAiUsageThisMonth(userId);
  return { allowed: used < limit, plan, used, limit };
}

async function enforceAiLimit(userId: number): Promise<void> {
  const { allowed, plan, used, limit } = await checkAiLimit(userId);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: plan === "free"
        ? `You've used all ${limit} free AI messages this month. Upgrade to Pro for ${PRO_AI_LIMIT} messages/month.`
        : `You've reached your ${limit} AI message limit for this month. Your limit resets next month.`,
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

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
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

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
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
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
    parseCsv: protectedProcedure
      .input(z.object({ csvText: z.string().min(1).max(2_000_000) })) // Max ~2MB
      .mutation(async ({ ctx, input }) => {
        const categories = await db.getUserCategories(ctx.user.id);

        const MAX_ROWS = 10_000;

        // Parse CSV manually — split lines, detect delimiter, map columns
        const lines = input.csvText.trim().split(/\r?\n/);
        if (lines.length < 2) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "CSV must have a header row and at least one data row." });
        }
        if (lines.length > MAX_ROWS + 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `CSV too large (${lines.length - 1} rows). Maximum is ${MAX_ROWS} rows.` });
        }

        // Detect delimiter
        const firstLine = lines[0];
        const delimiter = firstLine.includes("\t") ? "\t" : ",";

        // Parse a CSV line respecting quoted fields
        function parseLine(line: string): string[] {
          const result: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === delimiter && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += ch;
            }
          }
          result.push(current.trim());
          return result;
        }

        const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
        const rows = lines.slice(1).filter(l => l.trim()).map(l => parseLine(l));

        // Map columns by common header names
        const dateIdx = headers.findIndex(h => ["date", "transactiondate", "posteddate", "postdate"].includes(h));
        const amountIdx = headers.findIndex(h => ["amount", "total", "sum", "value", "price"].includes(h));
        const descIdx = headers.findIndex(h => ["description", "desc", "memo", "name", "merchant", "payee", "details", "narrative"].includes(h));
        const typeIdx = headers.findIndex(h => ["type", "transactiontype", "kind", "direction"].includes(h));
        const debitIdx = headers.findIndex(h => ["debit", "withdrawal", "expense"].includes(h));
        const creditIdx = headers.findIndex(h => ["credit", "deposit", "income"].includes(h));

        if (dateIdx === -1 && amountIdx === -1 && debitIdx === -1 && creditIdx === -1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Could not detect date/amount columns. Ensure your CSV has headers like Date, Amount, Description.",
          });
        }

        // Build category name→id map for matching
        const catNameMap: Record<string, { id: number; type: "income" | "expense" }> = {};
        for (const c of categories as any[]) {
          catNameMap[c.name.toLowerCase()] = { id: c.id, type: c.type };
        }
        const defaultExpenseCat = (categories as any[]).find((c: any) => c.type === "expense");
        const defaultIncomeCat = (categories as any[]).find((c: any) => c.type === "income");

        const parsed = rows.map((cols, i) => {
          // Parse amount
          let amount: number;
          let type: "income" | "expense";

          if (debitIdx !== -1 && creditIdx !== -1) {
            const debit = parseFloat((cols[debitIdx] ?? "").replace(/[^0-9.\-]/g, ""));
            const credit = parseFloat((cols[creditIdx] ?? "").replace(/[^0-9.\-]/g, ""));
            if (!isNaN(credit) && credit > 0) {
              amount = credit;
              type = "income";
            } else {
              amount = isNaN(debit) ? 0 : Math.abs(debit);
              type = "expense";
            }
          } else if (amountIdx !== -1) {
            const raw = parseFloat((cols[amountIdx] ?? "").replace(/[^0-9.\-]/g, ""));
            amount = isNaN(raw) ? 0 : Math.abs(raw);
            // Negative = expense, positive = income (common bank convention)
            if (typeIdx !== -1) {
              const typeVal = (cols[typeIdx] ?? "").toLowerCase();
              type = ["income", "credit", "deposit", "cr"].some(t => typeVal.includes(t)) ? "income" : "expense";
            } else {
              type = raw < 0 ? "expense" : "income";
            }
          } else {
            amount = 0;
            type = "expense";
          }

          // Parse date
          let date: string;
          if (dateIdx !== -1 && cols[dateIdx]) {
            const parsed = new Date(cols[dateIdx]);
            date = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
          } else {
            date = new Date().toISOString();
          }

          const description = descIdx !== -1 ? (cols[descIdx] ?? "").replace(/^"|"$/g, "") : `Row ${i + 1}`;

          // Default category
          const defaultCat = type === "income" ? defaultIncomeCat : defaultExpenseCat;

          return {
            amount: amount.toFixed(2),
            type,
            date,
            description,
            categoryId: defaultCat?.id ?? 0,
            categoryName: defaultCat?.name ?? "Uncategorized",
            rowIndex: i,
          };
        }).filter(r => parseFloat(r.amount) > 0);

        return {
          headers: headers,
          rows: parsed,
          totalRows: rows.length,
          parsedRows: parsed.length,
          skippedRows: rows.length - parsed.length,
        };
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
    // ── Persistent conversation history ──────────────────────────────────────
    getHistory: protectedProcedure
      .query(async ({ ctx }) => {
        const history = await db.getConversationHistory(ctx.user.id, 50);
        return history.map((m: any) => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
      }),

    clearHistory: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.clearConversationHistory(ctx.user.id);
        return { success: true };
      }),

    // ── Goal-aware chat with full conversation memory ─────────────────────────
    chat: protectedProcedure
      .input(z.object({ message: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.anthropicApiKey) {
          return { content: "AI assistant requires an ANTHROPIC_API_KEY to be configured." };
        }
        await enforceAiLimit(ctx.user.id);

        const [transactions, totals, goals, budgets, categories, wishlist, recurring, history, snapshots] = await Promise.all([
          db.getRecentUserTransactions(ctx.user.id, 6, 500),
          db.getUserTransactionTotals(ctx.user.id),
          db.getUserFinancialGoals(ctx.user.id),
          db.getUserBudgets(ctx.user.id),
          db.getUserCategories(ctx.user.id),
          db.getUserWishlistItems(ctx.user.id),
          db.getUserRecurringTransactions(ctx.user.id),
          db.getRecentConversation(ctx.user.id, 20),
          db.getMonthlySnapshots(ctx.user.id, 6),
        ]);

        const financialContext = buildFinancialContext({ transactions, goals, budgets, categories, wishlist, recurring, totals });
        const snapshotContext = buildSnapshotContext(snapshots);

        const systemPrompt = `You are a personal finance coach who remembers past conversations and tracks this user's habits over time.

${financialContext}${snapshotContext}

INSTRUCTIONS:
- Reference specific numbers from their data.
- When you see month-over-month history, call out improvements or regressions ("Your dining spend dropped 15% vs last month — great progress").
- If the user asked something similar before (visible in the conversation history), acknowledge it and show if anything changed.
- Give concise, actionable advice. Use markdown.`;

        // Build multi-turn message array from stored history + new user message
        const contextMessage = `[Financial profile attached above]\n\nUser: ${input.message}`;
        const claudeMessages: { role: "user" | "assistant"; content: string }[] = [];

        // Inject prior conversation turns (keep it to last 20 messages to stay within token limits)
        for (const msg of history) {
          claudeMessages.push({ role: msg.role as "user" | "assistant", content: msg.content });
        }
        claudeMessages.push({ role: "user", content: contextMessage });

        const content = await callClaude(ENV.anthropicApiKey, systemPrompt, claudeMessages, 1024);

        // Persist both sides of the conversation
        await db.appendConversationMessage(ctx.user.id, "user", input.message);
        await db.appendConversationMessage(ctx.user.id, "assistant", content);

        // Auto-save a monthly snapshot for the current month whenever the user chats
        const now = new Date();
        const income = (transactions as any[]).filter(t => t.type === "income").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
        const expenses = (transactions as any[]).filter(t => t.type === "expense").reduce((s: number, t: any) => s + parseFloat(t.amount), 0);
        const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

        const categoryMap: Record<number, string> = Object.fromEntries((categories as any[]).map((c: any) => [c.id, c.name]));
        const expByCategory = (transactions as any[]).filter(t => t.type === "expense").reduce((acc: Record<string, number>, t: any) => {
          const name = categoryMap[t.categoryId] ?? "Unknown";
          acc[name] = (acc[name] || 0) + parseFloat(t.amount);
          return acc;
        }, {});
        const topCategory = Object.entries(expByCategory).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] ?? null;

        const goalProgress = (goals as any[]).map((g: any) => ({
          name: g.name,
          pct: Math.min(Math.round((parseFloat(g.currentAmount ?? "0") / parseFloat(g.targetAmount)) * 100), 100),
        }));

        await db.upsertMonthlySnapshot(ctx.user.id, now.getFullYear(), now.getMonth() + 1, {
          totalIncome: income.toFixed(2),
          totalExpenses: expenses.toFixed(2),
          savingsRate: savingsRate.toFixed(2),
          topCategory,
          goalProgress: JSON.stringify(goalProgress),
        });

        await db.incrementAiUsage(ctx.user.id);
        return { content };
      }),

    // ── Proactive monthly insights (with trend comparison) ───────────────────
    monthlyInsights: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ENV.anthropicApiKey) {
          return { content: "AI insights require an ANTHROPIC_API_KEY to be configured." };
        }
        await enforceAiLimit(ctx.user.id);

        const [transactions, totals, goals, budgets, categories, wishlist, recurring, snapshots] = await Promise.all([
          db.getRecentUserTransactions(ctx.user.id, 6, 500),
          db.getUserTransactionTotals(ctx.user.id),
          db.getUserFinancialGoals(ctx.user.id),
          db.getUserBudgets(ctx.user.id),
          db.getUserCategories(ctx.user.id),
          db.getUserWishlistItems(ctx.user.id),
          db.getUserRecurringTransactions(ctx.user.id),
          db.getMonthlySnapshots(ctx.user.id, 6),
        ]);

        const context = buildFinancialContext({ transactions, goals, budgets, categories, wishlist, recurring, totals });
        const snapshotContext = buildSnapshotContext(snapshots);

        const content = await callClaudeSingle(
          ENV.anthropicApiKey,
          `You are a personal finance analyst who tracks habits over time. Generate a concise monthly financial health report. If monthly history is present, reference it to show trends ("Up 12% from last month", "Best savings rate in 3 months"). Structure with these exact markdown sections:
## Health Score
Rate 1–10 with one-sentence reason. If you have history, note if this is better or worse than prior months.
## What's Going Well
2-3 bullets with specific amounts or percentages. Reference trends if available.
## Alerts
2-3 bullets of issues or regressions vs prior months.
## Habit Trends
1-2 bullets on spending patterns observed over time (only if history available, otherwise skip this section).
## Top Action This Month
One specific step with a dollar amount.`,
          `${context}${snapshotContext}\n\nGenerate my monthly financial insights report.`,
          900,
        );

        await db.incrementAiUsage(ctx.user.id);
        return { content };
      }),

    // ── Goal-specific savings plan ───────────────────────────────────────────
    goalPlan: protectedProcedure
      .input(z.object({ goalId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.anthropicApiKey) {
          return { content: "AI planning requires an ANTHROPIC_API_KEY to be configured." };
        }
        await enforceAiLimit(ctx.user.id);

        const [transactions, totals, goals, budgets, categories, wishlist, recurring, snapshots] = await Promise.all([
          db.getRecentUserTransactions(ctx.user.id, 6, 500),
          db.getUserTransactionTotals(ctx.user.id),
          db.getUserFinancialGoals(ctx.user.id),
          db.getUserBudgets(ctx.user.id),
          db.getUserCategories(ctx.user.id),
          db.getUserWishlistItems(ctx.user.id),
          db.getUserRecurringTransactions(ctx.user.id),
          db.getMonthlySnapshots(ctx.user.id, 3),
        ]);

        const goal = (goals as any[]).find((g: any) => g.id === input.goalId);
        if (!goal) throw new TRPCError({ code: "NOT_FOUND", message: "Goal not found" });

        const context = buildFinancialContext({ transactions, goals, budgets, categories, wishlist, recurring, totals });
        const snapshotContext = buildSnapshotContext(snapshots);

        const content = await callClaudeSingle(
          ENV.anthropicApiKey,
          `You are a personal finance coach. Create a targeted savings plan using actual numbers from the user's data. If monthly history is available, factor in the user's actual average savings rate. Use markdown. 3 sections max.`,
          `${context}${snapshotContext}\n\nCreate a concrete savings plan for: "${goal.name}" ($${parseFloat(goal.targetAmount).toFixed(2)} by ${new Date(goal.targetDate).toLocaleDateString()}, currently $${parseFloat(goal.currentAmount ?? "0").toFixed(2)}).

Include:
1. Monthly savings needed and whether it's realistic given their actual income/expense history
2. Specific budget categories to trim with exact dollar amounts
3. Realistic timeline at current vs. optimized savings rate`,
          900,
        );

        await db.incrementAiUsage(ctx.user.id);
        return { content };
      }),

    // ── AI category suggestion ───────────────────────────────────────────────
    suggestCategory: protectedProcedure
      .input(z.object({
        description: z.string(),
        type: z.enum(["income", "expense"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.anthropicApiKey) return { categoryName: null, categoryId: null };

        const categories = await db.getUserCategories(ctx.user.id);
        const relevant = (categories as any[]).filter((c: any) => c.type === input.type);
        if (relevant.length === 0) return { categoryName: null, categoryId: null };

        const categoryNames = relevant.map((c: any) => c.name).join(", ");

        const content = await callClaudeSingle(
          ENV.anthropicApiKey,
          `You are a transaction categorizer. Reply with ONLY the single best matching category name — nothing else, no explanation, no punctuation. If none match, reply "none".`,
          `Transaction: "${input.description}"\nCategories: ${categoryNames}\n\nBest match:`,
          20,
        );

        const suggested = content.trim().replace(/[."']/g, "");
        const match = relevant.find((c: any) => c.name.toLowerCase() === suggested.toLowerCase());
        return { categoryName: match ? match.name : null, categoryId: match ? match.id : null };
      }),

    // ── What-if scenario analysis ────────────────────────────────────────────
    whatIf: protectedProcedure
      .input(z.object({ scenario: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.anthropicApiKey) {
          return { content: "AI analysis requires an ANTHROPIC_API_KEY to be configured." };
        }

        await enforceAiLimit(ctx.user.id);

        const [transactions, totals, goals, budgets, categories, wishlist, recurring, snapshots] = await Promise.all([
          db.getRecentUserTransactions(ctx.user.id, 6, 500),
          db.getUserTransactionTotals(ctx.user.id),
          db.getUserFinancialGoals(ctx.user.id),
          db.getUserBudgets(ctx.user.id),
          db.getUserCategories(ctx.user.id),
          db.getUserWishlistItems(ctx.user.id),
          db.getUserRecurringTransactions(ctx.user.id),
          db.getMonthlySnapshots(ctx.user.id, 3),
        ]);

        const context = buildFinancialContext({ transactions, goals, budgets, categories, wishlist, recurring, totals });
        const snapshotContext = buildSnapshotContext(snapshots);

        const content = await callClaudeSingle(
          ENV.anthropicApiKey,
          `You are a financial scenario analyst. Calculate the concrete impact of the scenario using the user's real numbers. Show before/after. Factor in historical spending patterns if available. Use markdown.`,
          `${context}${snapshotContext}\n\nWhat-if scenario: ${input.scenario}`,
          900,
        );

        await db.incrementAiUsage(ctx.user.id);

        return { content };
      }),
  }),

  // ── Monthly snapshots ─────────────────────────────────────────────────────
  snapshots: router({
    list: protectedProcedure
      .query(async ({ ctx }) => db.getMonthlySnapshots(ctx.user.id, 6)),
  }),

  // ── Auto-import integrations ───────────────────────────────────────────────
  integrations: router({
    // Status: which integrations are connected, pending queue count
    status: protectedProcedure
      .query(async ({ ctx }) => {
        const [gmailToken, pendingCount] = await Promise.all([
          db.getOauthToken(ctx.user.id, "gmail"),
          db.getPendingQueueCount(ctx.user.id),
        ]);
        return {
          gmail: gmailToken
            ? {
                connected: true,
                email: gmailToken.providerEmail,
                lastScannedAt: gmailToken.lastScannedAt,
              }
            : { connected: false },
          pendingCount,
          webhookUrl: `${ENV.appBaseUrl.replace("5173", "3000")}/api/webhook/sms`,
          webhookSecret: ENV.webhookSecret,
        };
      }),

    // Start Gmail OAuth — returns the Google consent URL
    gmailConnect: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ENV.googleClientId) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "GOOGLE_CLIENT_ID is not configured." });
        }
        const state = await buildOAuthState(ctx.user.id);
        const url = buildGmailAuthUrl(state);
        return { url };
      }),

    // Disconnect Gmail
    gmailDisconnect: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.deleteOauthToken(ctx.user.id, "gmail");
        return { success: true };
      }),

    // Scan Gmail for new financial emails → parse with AI → add to import queue
    gmailScan: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ENV.anthropicApiKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "ANTHROPIC_API_KEY is not configured." });
        }

        let token = await db.getOauthToken(ctx.user.id, "gmail");
        if (!token) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Gmail is not connected." });
        }

        // Refresh access token if expired
        if (token.tokenExpiry && new Date() > token.tokenExpiry && token.refreshToken) {
          const fresh = await refreshAccessToken(token.refreshToken);
          await db.upsertOauthToken(ctx.user.id, "gmail", {
            accessToken: fresh.access_token,
            refreshToken: fresh.refresh_token ?? token.refreshToken,
            tokenExpiry: new Date(Date.now() + fresh.expires_in * 1000),
            providerEmail: token.providerEmail,
            lastScannedAt: token.lastScannedAt,
          });
          token = await db.getOauthToken(ctx.user.id, "gmail");
          if (!token) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Token refresh failed." });
        }

        // Only look at emails since last scan (or last 7 days if first scan)
        const since = token.lastScannedAt
          ? token.lastScannedAt
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const emails = await fetchFinancialEmails(token.accessToken, since, 30);

        // Batch dedup check — single query instead of N queries
        const allRefs = emails.map(e => `gmail_${e.id}`);
        const existingRefs = await db.getExistingExternalRefs(ctx.user.id, allRefs);

        let queued = 0;
        let skipped = 0;

        // Process new emails with concurrency limit (max 5 AI calls at once)
        const newEmails = emails.filter(e => !existingRefs.has(`gmail_${e.id}`));
        skipped = emails.length - newEmails.length;

        const CONCURRENCY = 5;
        for (let i = 0; i < newEmails.length; i += CONCURRENCY) {
          const batch = newEmails.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map(async (email) => {
              const parsed = await parseEmailForTransaction(ENV.anthropicApiKey, email);
              if (!parsed) return null;
              await db.addToImportQueue({
                userId: ctx.user.id,
                source: "gmail",
                externalRef: `gmail_${email.id}`,
                amount: parsed.amount,
                transactionType: parsed.type,
                description: parsed.description,
                transactionDate: parsed.date ? new Date(parsed.date) : email.date,
                suggestedCategory: parsed.suggestedCategory,
                originalText: `${email.subject}\n${email.snippet}`.slice(0, 500),
                confidence: String(parsed.confidence),
                status: "pending",
              });
              return true;
            })
          );
          for (const r of results) {
            if (r.status === "fulfilled" && r.value) queued++;
            else skipped++;
          }
        }

        await db.updateLastScanned(ctx.user.id, "gmail");

        return { scanned: emails.length, queued, skipped };
      }),

    // Get the review queue
    queue: protectedProcedure
      .input(z.object({ status: z.enum(["pending", "approved", "dismissed"]).default("pending") }))
      .query(async ({ ctx, input }) => {
        return db.getImportQueue(ctx.user.id, input.status);
      }),

    // Approve one item → create the actual transaction
    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const [item] = await db.getImportQueue(ctx.user.id, "pending").then(
          rows => rows.filter(r => r.id === input.id),
        );
        if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Queue item not found." });

        // Find or use the first matching category by name
        const categories = await db.getUserCategories(ctx.user.id);
        const match = (categories as any[]).find(
          (c: any) => c.type === item.transactionType && c.name.toLowerCase() === (item.suggestedCategory ?? "").toLowerCase(),
        );
        // Fall back to first category of that type
        const fallback = (categories as any[]).find((c: any) => c.type === item.transactionType);
        const categoryId = match?.id ?? fallback?.id;

        if (!categoryId) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: `No ${item.transactionType} categories found. Create one first.` });
        }

        await db.createTransaction(
          ctx.user.id,
          categoryId,
          item.transactionType,
          String(item.amount),
          item.transactionDate,
          item.description ?? undefined,
        );

        await db.updateImportQueueStatus(input.id, ctx.user.id, "approved");
        return { success: true };
      }),

    // Approve all pending
    approveAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        const pending = await db.getImportQueue(ctx.user.id, "pending");
        const categories = await db.getUserCategories(ctx.user.id);

        let created = 0;
        for (const item of pending) {
          const match = (categories as any[]).find(
            (c: any) => c.type === item.transactionType && c.name.toLowerCase() === (item.suggestedCategory ?? "").toLowerCase(),
          );
          const fallback = (categories as any[]).find((c: any) => c.type === item.transactionType);
          const categoryId = match?.id ?? fallback?.id;
          if (!categoryId) continue;

          await db.createTransaction(
            ctx.user.id,
            categoryId,
            item.transactionType,
            String(item.amount),
            item.transactionDate,
            item.description ?? undefined,
          );
          created++;
        }

        await db.updateAllImportQueueStatus(ctx.user.id, "approved");
        return { created };
      }),

    // Dismiss one item
    dismiss: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateImportQueueStatus(input.id, ctx.user.id, "dismissed");
        return { success: true };
      }),

    // Dismiss all pending
    dismissAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.updateAllImportQueueStatus(ctx.user.id, "dismissed");
        return { success: true };
      }),
  }),

  // ── Billing ─────────────────────────────────────────────────────────────────
  billing: router({
    // Get current plan + usage
    status: protectedProcedure
      .query(async ({ ctx }) => {
        const sub = await db.getUserSubscription(ctx.user.id);
        const used = await db.getAiUsageThisMonth(ctx.user.id);
        const plan = sub?.plan === "pro" && sub.status === "active" ? "pro" : "free";
        const limit = plan === "pro" ? PRO_AI_LIMIT : FREE_AI_LIMIT;
        return {
          plan,
          status: sub?.status ?? "active",
          used,
          limit,
          currentPeriodEnd: sub?.currentPeriodEnd ?? null,
          paystackPublicKey: ENV.paystackPublicKey || null,
        };
      }),

    // Initialize Paystack checkout for Pro upgrade
    checkout: protectedProcedure
      .input(z.object({
        currency: z.enum(["NGN", "USD"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.paystackSecretKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing is not configured." });
        }

        const user = ctx.user;
        const planConfig = input.currency === "USD" ? PLANS.pro_usd : PLANS.pro_ngn;
        const planCode = input.currency === "USD" ? ENV.paystackPlanCodeUsd : ENV.paystackPlanCodeNgn;

        if (!planCode) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing plan not configured for this currency." });
        }

        const result = await initializeTransaction({
          email: user.email,
          amount: planConfig.amount,
          currency: planConfig.currency,
          plan: planCode,
          callback_url: `${ENV.appBaseUrl}/billing?status=success`,
          metadata: {
            userId: user.id,
            plan: "pro",
            custom_fields: [
              { display_name: "User ID", variable_name: "user_id", value: String(user.id) },
            ],
          },
        });

        return { authorizationUrl: result.authorization_url, reference: result.reference };
      }),

    // Verify a completed transaction and activate subscription
    verify: protectedProcedure
      .input(z.object({ reference: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.paystackSecretKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Billing is not configured." });
        }

        const txn = await verifyTransaction(input.reference);

        if (txn.status !== "success") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Payment was not successful." });
        }

        // Activate subscription
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await db.upsertSubscription(ctx.user.id, {
          plan: "pro",
          status: "active",
          paystackCustomerCode: txn.customer?.customer_code,
          paystackSubscriptionCode: txn.subscription_code ?? null,
          currency: txn.currency,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });

        return { success: true, plan: "pro" };
      }),

    // Cancel subscription
    cancel: protectedProcedure
      .mutation(async ({ ctx }) => {
        const sub = await db.getUserSubscription(ctx.user.id);

        // If there's an active Paystack subscription, disable it
        if (sub?.paystackSubscriptionCode && sub.paystackEmailToken && ENV.paystackSecretKey) {
          try {
            await disableSubscription({
              code: sub.paystackSubscriptionCode,
              token: sub.paystackEmailToken,
            });
          } catch {
            // Continue with local cancellation even if Paystack call fails
          }
        }

        await db.cancelSubscription(ctx.user.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
