import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail, MessageSquare, CheckCircle2, XCircle, RefreshCw, Loader2,
  PlugZap, Unplug, Clock, Zap, Copy, CheckCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function AutoImport() {
  const [, setLocation] = useLocation();
  const [scanning, setScanning] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSmsSetup, setShowSmsSetup] = useState(false);

  const { data: status, refetch: refetchStatus } = trpc.integrations.status.useQuery();
  const { data: queue = [], refetch: refetchQueue } = trpc.integrations.queue.useQuery({ status: "pending" });

  const connectMutation = trpc.integrations.gmailConnect.useMutation();
  const disconnectMutation = trpc.integrations.gmailDisconnect.useMutation();
  const scanMutation = trpc.integrations.gmailScan.useMutation();
  const approveMutation = trpc.integrations.approve.useMutation();
  const approveAllMutation = trpc.integrations.approveAll.useMutation();
  const dismissMutation = trpc.integrations.dismiss.useMutation();
  const dismissAllMutation = trpc.integrations.dismissAll.useMutation();

  // Handle redirect back from Google OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected === "gmail") {
      toast.success("Gmail connected! Click Scan Now to import transactions.");
      refetchStatus();
      setLocation("/auto-import", { replace: true });
    } else if (error) {
      toast.error(`Connection failed: ${error.replace(/_/g, " ")}`);
      setLocation("/auto-import", { replace: true });
    }
  }, []);

  const handleGmailConnect = async () => {
    try {
      const { url } = await connectMutation.mutateAsync();
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start Gmail connection");
    }
  };

  const handleGmailDisconnect = async () => {
    await disconnectMutation.mutateAsync();
    refetchStatus();
    toast.success("Gmail disconnected");
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scanMutation.mutateAsync();
      refetchQueue();
      refetchStatus();
      if (result.queued > 0) {
        toast.success(`Found ${result.queued} new transaction${result.queued !== 1 ? "s" : ""} to review`);
      } else {
        toast.info(`Scanned ${result.scanned} emails — no new transactions found`);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      await approveMutation.mutateAsync({ id });
      refetchQueue();
      toast.success("Transaction added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add transaction");
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproveAll = async () => {
    setApprovingAll(true);
    try {
      const result = await approveAllMutation.mutateAsync();
      refetchQueue();
      toast.success(`Added ${result.created} transaction${result.created !== 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setApprovingAll(false);
    }
  };

  const handleDismiss = async (id: number) => {
    await dismissMutation.mutateAsync({ id });
    refetchQueue();
  };

  const handleDismissAll = async () => {
    await dismissAllMutation.mutateAsync();
    refetchQueue();
    toast.info("All items dismissed");
  };

  const copyWebhookSecret = () => {
    if (status?.webhookSecret) {
      navigator.clipboard.writeText(status.webhookSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confidenceColor = (c: string | null) => {
    const n = parseFloat(c ?? "0");
    if (n >= 0.85) return "text-green-600";
    if (n >= 0.65) return "text-yellow-600";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auto Import</h1>
        <p className="text-muted-foreground mt-2">
          Automatically capture transactions from Gmail alerts and SMS messages
        </p>
      </div>

      {/* Gmail Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center">
                <Mail className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-base">Gmail Auto-Scan</CardTitle>
                <CardDescription>
                  Reads bank alert emails and extracts transactions with AI
                </CardDescription>
              </div>
            </div>
            {status?.gmail.connected ? (
              <Badge variant="outline" className="text-green-600 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not connected
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.gmail.connected ? (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="text-sm">
                  <p className="font-medium">{status.gmail.email}</p>
                  {status.gmail.lastScannedAt ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      Last scanned {new Date(status.gmail.lastScannedAt).toLocaleString()}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Never scanned — click Scan Now</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleScan}
                    disabled={scanning}
                  >
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    {scanning ? "Scanning…" : "Scan Now"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGmailDisconnect}
                    disabled={disconnectMutation.isPending}
                    className="text-muted-foreground"
                  >
                    <Unplug className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Looks for emails with subjects like: <em>transaction, payment, charge, deposit, receipt, alert</em></p>
                <p>Only reads your primary inbox. No emails are modified or deleted.</p>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Gmail account so the app can scan for bank alerts, payment receipts, and transaction notifications — and automatically add them to your review queue.
              </p>
              <Button
                onClick={handleGmailConnect}
                disabled={connectMutation.isPending}
                className="gap-2"
              >
                <PlugZap className="h-4 w-4" />
                Connect Gmail
              </Button>
              <p className="text-xs text-muted-foreground">
                Requires <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> set in your server environment.
                <br />
                See <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong> to create OAuth 2.0 credentials.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS / Messages Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">SMS / Messages</CardTitle>
                <CardDescription>Forward bank SMS alerts via iOS Shortcuts or Android Tasker</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-300">
              <Zap className="h-3 w-3 mr-1" />
              Always on
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <button
            className="flex items-center gap-2 text-sm font-medium w-full text-left"
            onClick={() => setShowSmsSetup(v => !v)}
          >
            {showSmsSetup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Setup instructions
          </button>

          {showSmsSetup && (
            <div className="mt-4 space-y-4">
              {/* Webhook URL */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Webhook URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg break-all">
                    {status?.webhookUrl ?? "http://localhost:3000/api/webhook/sms"}
                  </code>
                </div>
              </div>

              {/* Webhook Secret */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Webhook Secret (x-webhook-secret header)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg">
                    {status?.webhookSecret ?? "••••••••"}
                  </code>
                  <Button size="sm" variant="ghost" onClick={copyWebhookSecret}>
                    {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* iOS Shortcut instructions */}
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <p className="font-medium flex items-center gap-2">
                  iOS Shortcut Setup
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                  <li>Open <strong>Shortcuts</strong> app → New Shortcut</li>
                  <li>Add action: <strong>Receive [Text] from Share Sheet</strong> (or "When I receive a message from [Bank]")</li>
                  <li>Add action: <strong>Get Contents of URL</strong></li>
                  <li>URL: paste the webhook URL above</li>
                  <li>Method: <strong>POST</strong>, Request Body: <strong>JSON</strong></li>
                  <li>Add fields: <code>text</code> = Shortcut Input, <code>userId</code> = your user ID</li>
                  <li>Headers: <code>x-webhook-secret</code> = your secret above</li>
                  <li>Set the shortcut to run <strong>automatically</strong> when a message from your bank arrives using <strong>Automations → Message → Run Immediately</strong></li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Android: Use <strong>Tasker</strong> with an HTTP POST task configured the same way.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Review Queue
                {queue.length > 0 && (
                  <Badge className="ml-2 bg-orange-500 text-white">{queue.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                AI-detected transactions waiting for your approval before being recorded
              </CardDescription>
            </div>
            {queue.length > 0 && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDismissAll}
                  disabled={dismissAllMutation.isPending}
                >
                  Dismiss All
                </Button>
                <Button
                  size="sm"
                  onClick={handleApproveAll}
                  disabled={approvingAll}
                >
                  {approvingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Approve All
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Queue is empty</p>
              <p className="text-sm mt-1">
                {status?.gmail.connected
                  ? "Click Scan Now to check for new emails"
                  : "Connect Gmail or set up SMS forwarding to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map(item => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-lg font-bold ${item.transactionType === "income" ? "text-green-600" : "text-red-600"}`}>
                        {item.transactionType === "income" ? "+" : "-"}${parseFloat(String(item.amount)).toFixed(2)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {item.suggestedCategory ?? "Other"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${item.source === "gmail" ? "border-red-200 text-red-600" : "border-blue-200 text-blue-600"}`}
                      >
                        {item.source === "gmail" ? <Mail className="h-3 w-3 mr-1" /> : <MessageSquare className="h-3 w-3 mr-1" />}
                        {item.source}
                      </Badge>
                      <span className={`text-xs font-medium ${confidenceColor(String(item.confidence))}`}>
                        {Math.round(parseFloat(String(item.confidence ?? "0")) * 100)}% confident
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{item.description || "Unknown transaction"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.transactionDate).toLocaleDateString()} ·{" "}
                      {item.originalText?.split("\n")[0]?.slice(0, 80)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDismiss(item.id)}
                      disabled={dismissMutation.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(item.id)}
                      disabled={approvingId === item.id}
                    >
                      {approvingId === item.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-muted">
        <CardContent className="pt-5">
          <p className="text-sm font-medium mb-3">How it works</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">1. Connect a source</p>
              <p>Link your Gmail or set up an SMS forward from your bank alerts.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">2. AI reads & parses</p>
              <p>Claude reads each message and extracts: amount, type, merchant, date, and category.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">3. You review & approve</p>
              <p>Items land in the queue above. One tap adds them to your transactions. You stay in control.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
