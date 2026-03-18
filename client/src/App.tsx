import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Wishlist from "./pages/Wishlist";
import Budgets from "./pages/Budgets";
import Recurring from "./pages/Recurring";
import Assistant from "./pages/Assistant";
import Landing from "./pages/Landing";
import { useAuth } from "./_core/hooks/useAuth";
import { useDemo } from "./contexts/DemoContext";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();

  // Show landing page if not authenticated and not in demo mode
  if (!loading && !user && !isDemoMode) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Show dashboard routes if authenticated or in demo mode
  return (
    <Switch>
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/transactions" component={() => <DashboardLayout><Transactions /></DashboardLayout>} />
      <Route path="/wishlist" component={() => <DashboardLayout><Wishlist /></DashboardLayout>} />
      <Route path="/budgets" component={() => <DashboardLayout><Budgets /></DashboardLayout>} />
      <Route path="/recurring" component={() => <DashboardLayout><Recurring /></DashboardLayout>} />
      <Route path="/assistant" component={() => <DashboardLayout><Assistant /></DashboardLayout>} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
