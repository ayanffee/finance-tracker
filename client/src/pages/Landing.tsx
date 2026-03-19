import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDemo } from "@/contexts/DemoContext";
import { BarChart3, TrendingUp, Target, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const { setDemoMode } = useDemo();
  const [, setLocation] = useLocation();

  const handleDemoMode = () => {
    setDemoMode(true);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <header className="border-b border-blue-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Finance Tracker</h1>
          </div>
          <Button onClick={() => setLocation("/login")} variant="outline">
            Sign In
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-6">
            Take Control of Your Money
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
            Track spending, set budgets, plan purchases, and get AI-powered financial insights all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleDemoMode} className="bg-blue-600 hover:bg-blue-700 text-white">
              Try Demo (No Login)
            </Button>
            <Button size="lg" onClick={() => setLocation("/login")} variant="outline">
              Sign In / Create Account
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2" />
              <CardTitle>Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">See your income, expenses, and balance at a glance with visual charts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400 mb-2" />
              <CardTitle>Track Spending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Log transactions, categorize expenses, and analyze spending patterns</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Target className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-2" />
              <CardTitle>Plan Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Create a wishlist and see how much you need to save for your goals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 text-yellow-600 dark:text-yellow-400 mb-2" />
              <CardTitle>AI Assistant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Get personalized financial advice and spending insights from AI</p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-16">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Everything You Need</h3>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Money Management</h4>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li>✓ Manual transaction entry</li>
                <li>✓ CSV bank statement import</li>
                <li>✓ Category-based tracking</li>
                <li>✓ Monthly spending breakdown</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Smart Features</h4>
              <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                <li>✓ Budget limits with alerts</li>
                <li>✓ Recurring transactions</li>
                <li>✓ Financial projections</li>
                <li>✓ AI financial advisor</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button size="lg" onClick={handleDemoMode} className="bg-blue-600 hover:bg-blue-700 text-white">
            Start with Demo
          </Button>
        </div>
      </main>
    </div>
  );
}
