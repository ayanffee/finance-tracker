import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, Sparkles } from "lucide-react";

// Auto Import requires the server-side OAuth + email-scanning pipeline
// (Gmail OAuth, AI extraction, webhook receiver). The app currently runs
// in client-only demo mode, so this page shows a clean unavailable state
// instead of trying to call endpoints that aren't deployed.

export default function AutoImport() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auto Import</h1>
        <p className="text-muted-foreground mt-2">
          Automatically capture transactions from Gmail alerts and SMS messages
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-blue-500" />
          </div>
          <CardTitle className="text-lg">Available with a connected backend</CardTitle>
          <CardDescription className="max-w-md">
            Auto Import needs server-side Gmail OAuth and an AI extraction
            pipeline. It’s disabled in this demo build — your transactions
            still work great, you just have to add them yourself.
          </CardDescription>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
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
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            When the backend is connected, link your Gmail and the app will
            scan for bank alerts, payment receipts, and notifications, then
            queue them up for one-tap approval.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base">SMS / Messages</CardTitle>
                <CardDescription>
                  Forward bank SMS alerts via iOS Shortcuts or Android Tasker
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A webhook endpoint receives forwarded SMS alerts, parses the
            amount/merchant/date with Claude, and pushes the result into your
            review queue.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
