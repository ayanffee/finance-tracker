import type { Express } from "express";
import express from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";
import { exchangeCodeForTokens, getGmailEmail } from "../gmail";
import { verifyWebhookSignature } from "../paystack";
import * as db from "../db";

function getSecretKey() {
  return new TextEncoder().encode(ENV.cookieSecret || "dev-secret-change-me-in-production");
}

// Build a signed JWT state so we know which userId is completing the OAuth flow
export async function buildOAuthState(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(getSecretKey());
}

export async function verifyOAuthState(state: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(state, getSecretKey());
    return typeof payload.userId === "number" ? payload.userId : null;
  } catch {
    return null;
  }
}

/** Register Paystack webhook BEFORE global body parsers (needs raw body for HMAC) */
export function registerPaystackWebhook(app: Express) {
  app.post("/api/webhook/paystack", express.raw({ type: "application/json" }), async (req, res) => {
    const signature = req.headers["x-paystack-signature"] as string;
    const rawBody = typeof req.body === "string" ? req.body : req.body.toString("utf-8");

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    try {
      const event = JSON.parse(rawBody);
      const eventType = event.event as string;
      const data = event.data;

      console.log(`[Paystack Webhook] ${eventType}`);

      if (eventType === "charge.success" && data.plan?.plan_code) {
        const email = data.customer?.email;
        if (!email) return res.sendStatus(200);

        const user = await db.getUserByEmail(email);
        if (!user) return res.sendStatus(200);

        await db.upsertSubscription(user.id, {
          plan: "pro",
          status: "active",
          paystackCustomerCode: data.customer.customer_code,
          paystackSubscriptionCode: data.plan_object?.subscription_code ?? data.subscription?.subscription_code ?? null,
          currency: data.currency ?? "NGN",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        console.log(`[Paystack] Activated pro for user ${user.id} (${email})`);
      } else if (eventType === "subscription.create") {
        const email = data.customer?.email;
        if (!email) return res.sendStatus(200);

        const user = await db.getUserByEmail(email);
        if (!user) return res.sendStatus(200);

        await db.upsertSubscription(user.id, {
          plan: "pro",
          status: "active",
          paystackCustomerCode: data.customer.customer_code,
          paystackSubscriptionCode: data.subscription_code,
          paystackEmailToken: data.email_token ?? null,
          currency: data.plan?.currency ?? "NGN",
          currentPeriodStart: data.createdAt ? new Date(data.createdAt) : new Date(),
          currentPeriodEnd: data.next_payment_date ? new Date(data.next_payment_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        console.log(`[Paystack] Subscription created for user ${user.id}`);
      } else if (eventType === "subscription.not_renew" || eventType === "subscription.disable") {
        const email = data.customer?.email;
        if (!email) return res.sendStatus(200);

        const user = await db.getUserByEmail(email);
        if (!user) return res.sendStatus(200);

        await db.cancelSubscription(user.id);
        console.log(`[Paystack] Subscription cancelled for user ${user.id}`);
      } else if (eventType === "invoice.payment_failed") {
        const email = data.customer?.email;
        if (!email) return res.sendStatus(200);

        const user = await db.getUserByEmail(email);
        if (!user) return res.sendStatus(200);

        await db.upsertSubscription(user.id, { status: "past_due" });
        console.log(`[Paystack] Payment failed for user ${user.id}`);
      }

      res.sendStatus(200);
    } catch (err: any) {
      console.error("[Paystack Webhook]", err);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}

export function registerOAuthRoutes(app: Express) {
  // ── Gmail OAuth callback ─────────────────────────────────────────────────
  app.get("/api/oauth/gmail/callback", async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      return res.redirect(`${ENV.appBaseUrl}/auto-import?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${ENV.appBaseUrl}/auto-import?error=missing_params`);
    }

    const userId = await verifyOAuthState(state);
    if (!userId) {
      return res.redirect(`${ENV.appBaseUrl}/auto-import?error=invalid_state`);
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const providerEmail = await getGmailEmail(tokens.access_token);

      await db.upsertOauthToken(userId, "gmail", {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        providerEmail,
      });

      res.redirect(`${ENV.appBaseUrl}/auto-import?connected=gmail`);
    } catch (err: any) {
      console.error("[Gmail OAuth]", err);
      res.redirect(`${ENV.appBaseUrl}/auto-import?error=token_exchange_failed`);
    }
  });

  // ── SMS webhook (public — secured by secret header) ──────────────────────
  // POST /api/webhook/sms
  // Headers: x-webhook-secret: <WEBHOOK_SECRET>
  // Body: { text: string, from?: string, userId?: number }
  //
  // iOS Shortcut: "Get Contents of URL" → POST this endpoint
  // Body: { "text": Shortcut Input, "userId": <your-user-id> }
  app.post("/api/webhook/sms", async (req, res) => {
    const secret = req.headers["x-webhook-secret"];
    if (secret !== ENV.webhookSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { text, from, userId } = req.body as { text?: string; from?: string; userId?: number };

    if (!text || !userId) {
      return res.status(400).json({ error: "text and userId are required" });
    }

    if (!ENV.anthropicApiKey) {
      return res.status(503).json({ error: "AI not configured" });
    }

    try {
      // Parse the SMS text with Claude
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ENV.anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 250,
          system: "You are a financial transaction parser. Reply with ONLY valid JSON, nothing else.",
          messages: [{
            role: "user",
            content: `Parse this bank/financial SMS message and extract the transaction. Reply ONLY with JSON:
{
  "isTransaction": boolean,
  "type": "income" | "expense",
  "amount": string,
  "description": string,
  "date": string,
  "suggestedCategory": string,
  "confidence": number
}
If not a real transaction, set "isTransaction": false.

SMS: ${text}`,
          }],
        }),
      });

      if (!response.ok) throw new Error("AI parse failed");
      const aiData = await response.json() as any;
      const raw = (aiData.content[0]?.text ?? "").replace(/```json?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(raw);

      if (!parsed.isTransaction || !parsed.amount || parseFloat(parsed.amount) <= 0) {
        return res.json({ queued: false, reason: "not_a_transaction" });
      }

      // Dedup by hashing the SMS text
      const hash = Buffer.from(text.slice(0, 100)).toString("base64");
      const alreadyQueued = await db.isAlreadyQueued(userId, `sms_${hash}`);
      if (alreadyQueued) {
        return res.json({ queued: false, reason: "duplicate" });
      }

      await db.addToImportQueue({
        userId,
        source: "sms",
        externalRef: `sms_${hash}`,
        amount: parsed.amount,
        transactionType: parsed.type,
        description: parsed.description || from || "SMS transaction",
        transactionDate: parsed.date ? new Date(parsed.date) : new Date(),
        suggestedCategory: parsed.suggestedCategory || "Other",
        originalText: text.slice(0, 500),
        confidence: String(parsed.confidence ?? 0.8),
        status: "pending",
      });

      res.json({ queued: true });
    } catch (err: any) {
      console.error("[SMS Webhook]", err);
      res.status(500).json({ error: "Parse failed" });
    }
  });

}
