import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingDown, TrendingUp, Sparkles, Loader2, RefreshCw, CalendarClock, Brain } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { useDemo } from "@/contexts/DemoContext";
import { useDemoData } from "@/hooks/useDemoData";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";

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

export default function Dashboard() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { demoData } = useDemoData();

  const { data: _transactions = [] } = trpc.transactions.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: _categories = [] } = trpc.categories.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: _recurring = [] } = trpc.recurring.list.useQuery(undefined, { enabled: !isDemoMode });
  const { data: snapshotsData = [] } = trpc.snapshots.list.useQuery(undefined, { enabled: !!user && !isDemoMode });
  const insightsMutation = trpc.assistant.monthlyInsights.useMutation();

  const transactions = isDemoMode ? demoData.transactions : _transactions;
  const categories = isDemoMode ? demoData.categories : _categories;
  const recurring = isDemoMode ? demoData.recurring : _recurring;

  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const handleGenerateInsights = async () => {
    if (!user) return;
    setLoadingInsights(true);
    try {
      const result = await insightsMutation.mutateAsync();
      setInsights(result.content);
    } catch {
      setInsights("Failed to generate insights. Please try again.");
    } finally {
      setLoadingInsights(false);
    }
  };

  // ── Totals ──────────────────────────────────────────────────────────────────
  const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
  const expenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
  const balance = income - expenses;

  // ── Trend chart (last 7 days) ───────────────────────────────────────────────
  const transactionsByDate = transactions.reduce((acc: Record<string, { ts: number; income: number; expense: number }>, t) => {
    const d = new Date(t.date);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!acc[date]) acc[date] = { ts: d.getTime(), income: 0, expense: 0 };
    const amount = parseFloat(t.amount);
    if (t.type === "income") acc[date].income += amount;
    else acc[date].expense += amount;
    return acc;
  }, {});

  const trendData = Object.entries(transactionsByDate)
    .sort(([, a], [, b]) => a.ts - b.ts)
    .slice(-7)
    .map(([date, data]) => ({ date, income: data.income, expense: data.expense }));

  // ── Category pie ────────────────────────────────────────────────────────────
  const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const expensesByCategory = transactions
    .filter(t => t.type === "expense")
    .reduce((acc: Record<number, number>, t) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

  const categoryData = Object.entries(expensesByCategory).map(([categoryId, amount]) => ({
    name: categoryMap[Number(categoryId)] ?? `Category ${categoryId}`,
    value: amount,
  }));

  const COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

  // ── Spending forecast from recurring ────────────────────────────────────────
  const activeRecurring = recurring.filter((r: any) => r.active !== false);
  const forecastExpenses = activeRecurring
    .filter((r: any) => r.type === "expense")
    .reduce((s: number, r: any) => s + monthlyEquivalent(parseFloat(r.amount), r.frequency), 0);
  const forecastIncome = activeRecurring
    .filter((r: any) => r.type === "income")
    .reduce((s: number, r: any) => s + monthlyEquivalent(parseFloat(r.amount), r.frequency), 0);
  const forecastSurplus = forecastIncome - forecastExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Welcome to Frugal — your smart finance dashboard</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${income.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${expenses.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${balance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Income minus expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Spending Forecast from Recurring */}
      {activeRecurring.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-blue-500" />
              <div>
                <CardTitle className="text-base">Next Month Forecast</CardTitle>
                <CardDescription>Based on your {activeRecurring.length} recurring transaction{activeRecurring.length !== 1 ? "s" : ""}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">+${forecastIncome.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Expected income</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-red-600">-${forecastExpenses.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Committed expenses</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold ${forecastSurplus >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {forecastSurplus >= 0 ? "+" : ""}${forecastSurplus.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Projected surplus</div>
              </div>
            </div>
            {forecastSurplus < 0 && (
              <p className="text-xs text-red-600 mt-3 font-medium">
                Your committed expenses exceed your recurring income — review your recurring transactions.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Monthly Insights */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <div>
                <CardTitle className="text-base">AI Monthly Report</CardTitle>
                <CardDescription>AI rates your finances 1–10 based on budget adherence, savings rate, and goal progress</CardDescription>
              </div>
            </div>
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateInsights}
                disabled={loadingInsights}
                className="shrink-0"
              >
                {loadingInsights ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {insights ? "Refresh" : "Generate"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!user && !isDemoMode ? (
            <p className="text-sm text-muted-foreground">Sign in to generate AI insights.</p>
          ) : loadingInsights ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing your complete financial profile...
            </div>
          ) : insights ? (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
              <Streamdown>{insights}</Streamdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click <strong>Generate</strong> to get a personalized financial report. AI will score your finances from 1–10 (based on how well you're sticking to budgets, your savings rate, and goal progress), flag any overspending alerts, and give you one clear action to take this month.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Month-over-Month Habit Trend */}
      {snapshotsData.length >= 2 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-green-500" />
              <div>
                <CardTitle className="text-base">Habit Trends</CardTitle>
                <CardDescription>Your savings rate and spending over the last {snapshotsData.length} months</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={snapshotsData.map((s: any) => ({
                month: new Date(s.year, s.month - 1).toLocaleString("en-US", { month: "short" }),
                income: parseFloat(s.totalIncome),
                expenses: parseFloat(s.totalExpenses),
                savings: parseFloat(s.savingsRate),
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="money" orientation="left" tickFormatter={v => `$${v}`} />
                <YAxis yAxisId="rate" orientation="right" tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(value, name) => name === "Savings Rate" ? `${Number(value).toFixed(1)}%` : `$${Number(value).toFixed(0)}`} />
                <Legend />
                <Bar yAxisId="money" dataKey="income" fill="#10b981" name="Income" />
                <Bar yAxisId="money" dataKey="expenses" fill="#ef4444" name="Expenses" />
                <Line yAxisId="rate" type="monotone" dataKey="savings" stroke="#8b5cf6" name="Savings Rate" strokeWidth={2} dot />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {snapshotsData.length >= 2 && (() => {
                const last = snapshotsData[snapshotsData.length - 1] as any;
                const prev = snapshotsData[snapshotsData.length - 2] as any;
                const expDiff = parseFloat(last.totalExpenses) - parseFloat(prev.totalExpenses);
                const rateDiff = parseFloat(last.savingsRate) - parseFloat(prev.savingsRate);
                return (
                  <>
                    <span className={expDiff <= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      Expenses {expDiff <= 0 ? "↓" : "↑"} ${Math.abs(expDiff).toFixed(0)} vs last month
                    </span>
                    <span className={rateDiff >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      Savings rate {rateDiff >= 0 ? "↑" : "↓"} {Math.abs(rateDiff).toFixed(1)}% vs last month
                    </span>
                    {last.topCategory && <span>Top spend: <strong>{last.topCategory}</strong></span>}
                  </>
                );
              })()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Chat with your <Link href="/assistant" className="underline text-purple-600">AI coach</Link> to get personalized habit feedback.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#10b981" name="Income" />
                <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Expenses" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>By category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${typeof value === "number" ? value.toFixed(2) : value}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No expense data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest financial activity</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-4">
              {transactions.slice(-5).reverse().map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{transaction.description || "Transaction"}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(transaction.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`text-lg font-semibold ${transaction.type === "income" ? "text-green-600" : "text-red-600"}`}>
                    {transaction.type === "income" ? "+" : "-"}${parseFloat(transaction.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet. Start by adding your first transaction!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
