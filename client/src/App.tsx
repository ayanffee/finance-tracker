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
import Goals from "./pages/Goals";
import AutoImport from "./pages/AutoImport";
import Billing from "./pages/Billing";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

function Router() {
  // Auth gate temporarily removed — land straight in the app.
  // Landing / Login pages still reachable via their explicit paths.
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/landing" component={Landing} />
      <Route path="/" component={() => <DashboardLayout><Dashboard /></DashboardLayout>} />
      <Route path="/transactions" component={() => <DashboardLayout><Transactions /></DashboardLayout>} />
      <Route path="/wishlist" component={() => <DashboardLayout><Wishlist /></DashboardLayout>} />
      <Route path="/budgets" component={() => <DashboardLayout><Budgets /></DashboardLayout>} />
      <Route path="/recurring" component={() => <DashboardLayout><Recurring /></DashboardLayout>} />
      <Route path="/goals" component={() => <DashboardLayout><Goals /></DashboardLayout>} />
      <Route path="/assistant" component={() => <DashboardLayout><Assistant /></DashboardLayout>} />
      <Route path="/auto-import" component={() => <DashboardLayout><AutoImport /></DashboardLayout>} />
      <Route path="/billing" component={() => <DashboardLayout><Billing /></DashboardLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
