import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Check } from "lucide-react";

// Billing depends on the Paystack server integration. While the backend
// is offline (demo mode), show a static plan overview instead of calling
// trpc.billing.* — which would just throw FUNCTION_INVOCATION_FAILED.

const PRO_FEATURES = [
  "Unlimited AI Assistant chats",
  "Gmail Auto-Scan + SMS auto-import",
  "Long-term cross-device sync",
  "Priority support",
];

export default function Billing() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-2">
          Manage your Frugal subscription
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current plan
                <Badge variant="secondary">Demo</Badge>
              </CardTitle>
              <CardDescription>
                You’re on the free, client-only demo. All your data stays in
                this browser.
              </CardDescription>
            </div>
            <Sparkles className="h-6 w-6 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Sign-up &amp; paid plans require the server backend. This build of
            the app runs entirely in your browser, so checkout is disabled.
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-200 dark:border-blue-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <CardTitle>Frugal Pro</CardTitle>
                <CardDescription>What you get when the backend is connected</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">$5</div>
              <div className="text-xs text-muted-foreground">/ month</div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {PRO_FEATURES.map(feature => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
