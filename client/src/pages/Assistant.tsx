import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Brain, TrendingDown, Target, HelpCircle } from "lucide-react";

// AI Assistant relies on a server-side Claude/Anthropic call. While the
// backend is offline (demo mode), show a friendly placeholder instead of
// trying to chat with a 500-ing endpoint.

const CAPABILITIES = [
  {
    icon: TrendingDown,
    title: "Spending insights",
    body: "“Where am I spending the most?” gets a real answer pulled from your transactions and budgets.",
  },
  {
    icon: Target,
    title: "Goal coaching",
    body: "Ask if you’re on track and the assistant builds a savings plan from your recurring income/expenses.",
  },
  {
    icon: HelpCircle,
    title: "What-If scenarios",
    body: "“What if I added $200/month to savings?” → simulated results in seconds.",
  },
  {
    icon: Brain,
    title: "Memory across chats",
    body: "Remembers earlier questions and the patterns it has noticed about your habits.",
  },
];

export default function Assistant() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
        <p className="text-muted-foreground mt-2">
          Your personal financial coach
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-lg">Available with a connected backend</CardTitle>
          <CardDescription className="max-w-md">
            Chat is disabled in this demo build because it needs a server-side
            call to Claude. The rest of the app works entirely on your device —
            track transactions, budgets, goals, and recurring entries below.
          </CardDescription>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {CAPABILITIES.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {body}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
