/**
 * Paystack integration for Frugal billing.
 * Handles plan creation, checkout initialization, subscription management, and webhook verification.
 */

import crypto from "crypto";
import { ENV } from "./_core/env";

const PAYSTACK_BASE = "https://api.paystack.co";

function getHeaders() {
  return {
    Authorization: `Bearer ${ENV.paystackSecretKey}`,
    "Content-Type": "application/json",
  };
}

async function paystackRequest<T = any>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as any;
  if (!data.status) {
    throw new Error(data.message || "Paystack API error");
  }
  return data.data as T;
}

// ── Plans ────────────────────────────────────────────────────────────────────

export interface PaystackPlan {
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
}

export async function createPlan(opts: {
  name: string;
  amount: number; // in kobo (NGN) or cents (USD)
  interval: "monthly" | "annually";
  currency: "NGN" | "USD";
}): Promise<PaystackPlan> {
  return paystackRequest("POST", "/plan", opts);
}

export async function listPlans(): Promise<PaystackPlan[]> {
  return paystackRequest("GET", "/plan");
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export interface InitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeTransaction(opts: {
  email: string;
  amount: number; // kobo/cents
  currency: "NGN" | "USD";
  plan?: string; // plan_code for recurring
  callback_url?: string;
  metadata?: Record<string, any>;
}): Promise<InitializeResponse> {
  return paystackRequest("POST", "/transaction/initialize", {
    email: opts.email,
    amount: opts.amount,
    currency: opts.currency,
    plan: opts.plan,
    callback_url: opts.callback_url,
    metadata: opts.metadata,
  });
}

export async function verifyTransaction(reference: string): Promise<any> {
  return paystackRequest("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
}

// ── Subscriptions ────────────────────────────────────────────────────────────

export async function getSubscription(subscriptionCode: string): Promise<any> {
  return paystackRequest("GET", `/subscription/${encodeURIComponent(subscriptionCode)}`);
}

export async function disableSubscription(opts: {
  code: string;
  token: string;
}): Promise<any> {
  return paystackRequest("POST", "/subscription/disable", opts);
}

// ── Webhook verification ─────────────────────────────────────────────────────

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha512", ENV.paystackSecretKey)
    .update(body)
    .digest("hex");
  return hash === signature;
}

// ── Price config ─────────────────────────────────────────────────────────────

export const PLANS = {
  pro_ngn: {
    name: "Frugal Pro (NGN)",
    amount: 500000, // ₦5,000 in kobo
    currency: "NGN" as const,
    interval: "monthly" as const,
  },
  pro_usd: {
    name: "Frugal Pro (USD)",
    amount: 500, // $5.00 in cents
    currency: "USD" as const,
    interval: "monthly" as const,
  },
} as const;

export const FREE_AI_LIMIT = 3;  // Free tier: 3 AI messages/month
export const PRO_AI_LIMIT = 50;  // Pro tier: 50 AI messages/month
