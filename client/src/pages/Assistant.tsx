import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Assistant() {
  const { data: transactions = [] } = trpc.transactions.list.useQuery();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hi! I\'m your AI financial assistant. I can help you understand your spending patterns, answer questions about your finances, and provide personalized tips. Ask me anything like "Why am I broke?" or "Where am I spending the most?"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Calculate financial metrics for context
  const calculateMetrics = () => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const balance = income - expenses;

    // Last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = transactions.filter(t => new Date(t.date) > thirtyDaysAgo);
    const recentIncome = recentTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const recentExpenses = recentTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Top expense categories
    const expensesByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc: Record<number, number>, t) => {
        acc[t.categoryId] = (acc[t.categoryId] || 0) + parseFloat(t.amount);
        return acc;
      }, {});

    const topCategories = Object.entries(expensesByCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      balance,
      recentIncome,
      recentExpenses,
      recentBalance: recentIncome - recentExpenses,
      topCategories,
      transactionCount: transactions.length,
    };
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const metrics = calculateMetrics();
      const context = `
User's Financial Summary:
- Total Income: $${metrics.totalIncome.toFixed(2)}
- Total Expenses: $${metrics.totalExpenses.toFixed(2)}
- Overall Balance: $${metrics.balance.toFixed(2)}
- Last 30 Days Income: $${metrics.recentIncome.toFixed(2)}
- Last 30 Days Expenses: $${metrics.recentExpenses.toFixed(2)}
- Last 30 Days Balance: $${metrics.recentBalance.toFixed(2)}
- Total Transactions: ${metrics.transactionCount}

User Question: ${userMessage}
`;

      // Simulate AI response with financial insights
      const mockResponses: Record<string, string> = {
        'why am i broke': `Based on your financial data, here's why you might be feeling broke:\n\n1. **Spending Pattern**: Your total expenses ($${metrics.totalExpenses.toFixed(2)}) are ${((metrics.totalExpenses / metrics.totalIncome) * 100).toFixed(0)}% of your income.\n\n2. **Recent Trend**: In the last 30 days, you spent $${metrics.recentExpenses.toFixed(2)} against $${metrics.recentIncome.toFixed(2)} in income.\n\n3. **Top Spending Categories**: Your biggest expenses are in categories ${metrics.topCategories.map(([cat, amount]) => `#${cat} ($${amount.toFixed(2)})`).join(', ')}.\n\n**Recommendation**: Try to reduce discretionary spending in your top categories by 10-15% to improve your cash flow.`,
        'where am i spending': `Your spending breakdown shows:\n\n**Total Expenses**: $${metrics.totalExpenses.toFixed(2)}\n\n**Top Spending Categories**:\n${metrics.topCategories.map(([cat, amount], i) => `${i + 1}. Category #${cat}: $${amount.toFixed(2)} (${((amount / metrics.totalExpenses) * 100).toFixed(1)}%)`).join('\n')}\n\nConsider reviewing these categories to identify areas where you can cut back.`,
        'how can i save money': `Here are personalized savings tips based on your data:\n\n1. **Current Savings Rate**: You're currently saving $${metrics.balance.toFixed(2)} total (${((metrics.balance / metrics.totalIncome) * 100).toFixed(1)}% of income).\n\n2. **Quick Wins**: Your top 3 spending categories account for ${((metrics.topCategories.reduce((sum, [, amount]) => sum + amount, 0) / metrics.totalExpenses) * 100).toFixed(0)}% of expenses. Reducing these by 20% could save you $${(metrics.topCategories.reduce((sum, [, amount]) => sum + amount, 0) * 0.2).toFixed(2)}/month.\n\n3. **Action Plan**:\n   - Set a monthly budget for each category\n   - Track spending daily\n   - Cut unnecessary subscriptions\n   - Use the 50/30/20 rule (50% needs, 30% wants, 20% savings)`,
        'what is my balance': `Your current financial position:\n\n**Overall**: $${metrics.balance.toFixed(2)} (Income: $${metrics.totalIncome.toFixed(2)} - Expenses: $${metrics.totalExpenses.toFixed(2)})\n\n**Last 30 Days**: $${metrics.recentBalance.toFixed(2)} (Income: $${metrics.recentIncome.toFixed(2)} - Expenses: $${metrics.recentExpenses.toFixed(2)})\n\nYou have ${metrics.transactionCount} transactions recorded.`,
      };

      let response = mockResponses['default'] || `Based on your financial data:\n\n- Total Income: $${metrics.totalIncome.toFixed(2)}\n- Total Expenses: $${metrics.totalExpenses.toFixed(2)}\n- Current Balance: $${metrics.balance.toFixed(2)}\n\nI'm analyzing your spending patterns to provide better insights. Keep tracking your transactions for more accurate recommendations!`;

      // Check for keyword matches
      const lowerInput = userMessage.toLowerCase();
      for (const [key, value] of Object.entries(mockResponses)) {
        if (lowerInput.includes(key)) {
          response = value;
          break;
        }
      }

      // If no keyword match, provide generic financial advice
      if (response === mockResponses['default']) {
        response = `Great question! Based on your financial summary:\n\n**Your Numbers**:\n- Income: $${metrics.totalIncome.toFixed(2)}\n- Expenses: $${metrics.totalExpenses.toFixed(2)}\n- Balance: $${metrics.balance.toFixed(2)}\n\n**My Advice**: Focus on tracking all your transactions consistently. The more data you provide, the better insights I can give you. Try asking me:\n- "Why am I broke?"\n- "Where am I spending?"\n- "How can I save money?"\n- "What is my balance?"`;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      toast.error('Failed to get response');
      setMessages(prev => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Financial Assistant</h1>
        <p className="text-muted-foreground mt-2">Ask me anything about your finances</p>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Chat with Your Financial Advisor</CardTitle>
          <CardDescription>Get personalized insights about your spending and savings</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Streamdown>{message.content}</Streamdown>
                  ) : (
                    <p className="text-sm">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground px-4 py-2 rounded-lg flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Ask me about your finances..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
              disabled={loading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={loading || !input.trim()}
              size="icon"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>Try asking me:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>"Why am I broke?"</li>
              <li>"Where am I spending the most?"</li>
              <li>"How can I save money?"</li>
              <li>"What is my balance?"</li>
              <li>"What are my spending patterns?"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
