import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Assistant() {
  const { user } = useAuth();
  const { data: transactions = [] } = trpc.transactions.list.useQuery(undefined, { enabled: !!user });
  const chatMutation = trpc.assistant.chat.useMutation();
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
      const financialContext = `User's Financial Summary:
- Total Income: $${metrics.totalIncome.toFixed(2)}
- Total Expenses: $${metrics.totalExpenses.toFixed(2)}
- Overall Balance: $${metrics.balance.toFixed(2)}
- Last 30 Days Income: $${metrics.recentIncome.toFixed(2)}
- Last 30 Days Expenses: $${metrics.recentExpenses.toFixed(2)}
- Last 30 Days Balance: $${metrics.recentBalance.toFixed(2)}
- Total Transactions: ${metrics.transactionCount}`;

      let response: string;

      if (user) {
        // Use real AI when authenticated
        const result = await chatMutation.mutateAsync({ message: userMessage, financialContext });
        response = result.content;
      } else {
        // Fallback mock responses for demo mode
        const lowerInput = userMessage.toLowerCase();
        if (lowerInput.includes("broke") || lowerInput.includes("spending")) {
          response = `Based on your financial data:\n\n- **Income**: $${metrics.totalIncome.toFixed(2)}\n- **Expenses**: $${metrics.totalExpenses.toFixed(2)}\n- **Balance**: $${metrics.balance.toFixed(2)}\n\nYour expenses are **${((metrics.totalExpenses / (metrics.totalIncome || 1)) * 100).toFixed(0)}%** of your income. Sign in to get real AI-powered insights!`;
        } else if (lowerInput.includes("save") || lowerInput.includes("balance")) {
          response = `Your current balance is **$${metrics.balance.toFixed(2)}**.\n\nLast 30 days: Income $${metrics.recentIncome.toFixed(2)} — Expenses $${metrics.recentExpenses.toFixed(2)}.\n\n💡 Sign in to unlock personalized AI advice!`;
        } else {
          response = `I can see you have **${metrics.transactionCount} transactions** with a balance of **$${metrics.balance.toFixed(2)}**.\n\nFor real AI-powered financial analysis, sign in to your account!`;
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
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
