import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Crown, Sparkles, Loader2, Check, AlertCircle, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";

export default function Billing() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const statusParam = params.get("status");
  const referenceParam = params.get("reference") || params.get("trxref");
  const [verifying, setVerifying] = useState(false);

  const { data: billing, isLoading, refetch } = trpc.billing.status.useQuery();
  const checkoutMutation = trpc.billing.checkout.useMutation();
  const verifyMutation = trpc.billing.verify.useMutation();
  const cancelMutation = trpc.billing.cancel.useMutation();

  // Handle Paystack redirect callback
  useEffect(() => {
    if (statusParam === "success" && referenceParam && !verifying) {
      setVerifying(true);
      verifyMutation.mutate(
        { reference: referenceParam },
        {
          onSuccess: () => {
            toast.success("Welcome to Frugal Pro! Your subscription is now active.");
            refetch();
            // Clean URL
            window.history.replaceState({}, "", "/billing");
          },
          onError: (err) => {
            toast.error(err.message || "Could not verify payment. Please contact support.");
            window.history.replaceState({}, "", "/billing");
          },
          onSettled: () => setVerifying(false),
        }
      );
    }
  }, [statusParam, referenceParam]);

  const handleUpgrade = (currency: "NGN" | "USD") => {
    checkoutMutation.mutate(
      { currency },
      {
        onSuccess: (data) => {
          // Redirect to Paystack checkout
          window.location.href = data.authorizationUrl;
        },
        onError: (err) => {
          toast.error(err.message || "Could not start checkout. Please try again.");
        },
      }
    );
  };

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel your Pro subscription? You'll lose access to Pro features at the end of your billing period.")) {
      return;
    }
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Subscription cancelled. You'll retain Pro access until the end of your current period.");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message || "Could not cancel subscription.");
      },
    });
  };

  if (isLoading || verifying) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPro = billing?.plan === "pro";
  const usagePercent = billing ? Math.min(100, Math.round((billing.used / billing.limit) * 100)) : 0;
  const isNearLimit = usagePercent >= 80;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {isPro ? <Crown className="h-5 w-5 text-amber-500" /> : <Zap className="h-5 w-5 text-muted-foreground" />}
              Current Plan
            </CardTitle>
            <Badge variant={isPro ? "default" : "secondary"} className={isPro ? "bg-amber-500 hover:bg-amber-600" : ""}>
              {isPro ? "Pro" : "Free"}
            </Badge>
          </div>
          {isPro && billing?.currentPeriodEnd && (
            <CardDescription>
              Renews {new Date(billing.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* AI Usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Usage This Month
          </CardTitle>
          <CardDescription>
            {billing?.used ?? 0} of {billing?.limit ?? 0} messages used
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={usagePercent} className="h-2" />
          {isNearLimit && !isPro && (
            <div className="flex items-start gap-2 mt-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>You're running low on AI messages. Upgrade to Pro for 50 messages per month.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade / Manage */}
      {!isPro ? (
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              Upgrade to Frugal Pro
            </CardTitle>
            <CardDescription>
              Get more from your financial AI assistant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {[
                "50 AI messages per month (vs. 3 on Free)",
                "Advanced financial insights & scenario analysis",
                "Monthly AI-powered spending reports",
                "Priority support",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => handleUpgrade("NGN")}
                disabled={checkoutMutation.isPending}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Crown className="h-4 w-4 mr-2" />
                )}
                Upgrade — ₦5,000/mo
              </Button>
              <Button
                onClick={() => handleUpgrade("USD")}
                disabled={checkoutMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Crown className="h-4 w-4 mr-2" />
                )}
                Upgrade — $5/mo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Manage Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cancel Subscription
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
