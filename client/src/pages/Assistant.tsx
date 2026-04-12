import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, Sparkles, TrendingDown, Target, HelpCircle, Brain, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDemo } from "@/contexts/DemoContext";
import { useDemoData } from "@/hooks/useDemoData";

interface Message {
  role: "user" | "assistant";
  content: string;
  isHistorical?: boolean;
}

const WHAT_IF_PROMPTS = [
  "What if I cut my dining expenses by $100/month?",
  "What if I added an extra $200/month to savings?",
  "What if I cancelled my subscription services?",
  "What if I got a 10% raise?",
];

const QUICK_QUESTIONS = [
  "Am I on track to reach my goals?",
  "How have my spending habits changed?",
  "Where am I spending the most?",
  "How can I save more this month?",
  "What should I cut to save faster?",
  "How long until I reach my biggest goal?",
];

export default function Assistant() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { demoData } = useDemoData();

  const { data: historyData, refetch: refetchHistory } = trpc.assistant.getHistory.useQuery(undefined, {
    enabled: !!user && !isDemoMode,
  });

  const chatMutation = trpc.assistant.chat.useMutation();
  const whatIfMutation = trpc.assistant.whatIf.useMutation();
  const clearHistoryMutation = trpc.assistant.clearHistory.useMutation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history from DB when it arrives
  useEffect(() => {
    if (historyData && !historyLoaded) {
      if (historyData.length > 0) {
        const historical: Message[] = historyData.map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          isHistorical: true,
        }));
        setMessages(historical);
      } else {
        setMessages([{
          role: "assistant",
          content: `Hi! I'm your AI financial coach. I remember our past conversations and track your spending habits over time — so I get more useful the more you use me.\n\nTry asking:\n- "How have my spending habits changed?"\n- "Am I on track to reach my goals?"\n- Or pick a **What-If** scenario below.`,
        }]);
      }
      setHistoryLoaded(true);
    }
  }, [historyData, historyLoaded]);

  // For non-logged-in / demo users
  useEffect(() => {
    if (!user && !isDemoMode && !historyLoaded) {
      setMessages([{
        role: "assistant",
        content: "Sign in to access your AI financial coach with full conversation memory and habit tracking.",
      }]);
      setHistoryLoaded(true);
    }
    if (isDemoMode && !historyLoaded) {
      setMessages([{
        role: "assistant",
        content: "Hi! I'm your AI financial coach (demo mode). Sign in to unlock conversation memory and habit tracking across sessions.",
      }]);
      setHistoryLoaded(true);
    }
  }, [user, isDemoMode, historyLoaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string, isWhatIf = false) => {
    if (!text.trim()) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      let response: string;

      if (user && !isDemoMode) {
        if (isWhatIf) {
          const result = await whatIfMutation.mutateAsync({ scenario: text });
          response = result.content;
        } else {
          const result = await chatMutation.mutateAsync({ message: text });
          response = result.content;
        }
      } else {
        const { transactions, goals } = demoData;
        const income = transactions.filter(t => t.type === "income").reduce((s, t) => s + parseFloat(t.amount), 0);
        const expenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + parseFloat(t.amount), 0);
        response = `Based on your demo data:\n\n- **Income**: $${income.toFixed(2)}\n- **Expenses**: $${expenses.toFixed(2)}\n- **Balance**: $${(income - expenses).toFixed(2)}\n- **Goals**: ${goals.map(g => g.name).join(", ") || "None"}\n\nSign in to get real AI coaching with memory of past conversations and habit tracking!`;
      }

      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    } catch {
      toast.error("Failed to get response");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!user) return;
    try {
      await clearHistoryMutation.mutateAsync();
      setHistoryLoaded(false);
      await refetchHistory();
      toast.success("Conversation history cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const historicalCount = messages.filter(m => m.isHistorical).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Financial Coach</h1>
          <p className="text-muted-foreground mt-2">
            Learns your habits. Remembers your progress. Gets smarter every conversation.
          </p>
        </div>
        {user && historicalCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearHistory}
            disabled={clearHistoryMutation.isPending}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear history
          </Button>
        )}
      </div>

      {/* Memory indicator */}
      {user && historicalCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-sm text-purple-700 dark:text-purple-300">
          <Brain className="h-4 w-4 shrink-0" />
          <span>
            Loaded <strong>{historicalCount} messages</strong> from your conversation history — your coach remembers your past discussions and spending patterns.
          </span>
        </div>
      )}

      {/* What-If Scenarios */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            What-If Scenarios
          </CardTitle>
          <CardDescription>Model a change and see the real impact on your goals and cash flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {WHAT_IF_PROMPTS.map(prompt => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => sendMessage(prompt, true)}
                disabled={loading}
                className="text-xs h-8"
              >
                {prompt}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat */}
      <Card className="h-[400px] sm:h-[520px] flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            Chat with Your Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
            {/* Historical divider */}
            {historicalCount > 0 && messages.length > historicalCount && (
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Previous session above · New below</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {messages.map((message, index) => {
              const isLastHistorical = message.isHistorical && (index === historicalCount - 1);
              return (
                <div key={index}>
                  {isLastHistorical && messages.length > historicalCount && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">New conversation</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-4 py-2 rounded-lg text-sm ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : message.isHistorical
                          ? "bg-muted/60 text-foreground/80 border border-border"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <Streamdown>{message.content}</Streamdown>
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing your finances...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Ask about your habits, goals, or finances..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && sendMessage(input)}
              disabled={loading}
            />
            <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Questions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-green-500" />
            Quick Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map(q => (
              <Badge
                key={q}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 text-xs py-1 px-3"
                onClick={() => sendMessage(q)}
              >
                {q}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="pt-4">
          <div className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
            <TrendingDown className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Your coach gets smarter over time — it tracks month-over-month habit changes, remembers what you've discussed, and builds a long-term picture of your financial health.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
