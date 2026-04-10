/**
 * Gmail OAuth + email scanning module.
 * Uses Gmail REST API directly — no extra npm packages needed.
 */
import { ENV } from "./_core/env";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// Scopes needed: read messages + manage labels (to mark processed)
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
].join(" ");

// ── OAuth URLs ────────────────────────────────────────────────────────────────

export function buildGmailAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    redirect_uri: ENV.googleRedirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ── Token exchange + refresh ──────────────────────────────────────────────────

export interface GmailTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GmailTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: ENV.googleRedirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as Promise<GmailTokens>;
}

export async function refreshAccessToken(refreshToken: string): Promise<GmailTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json() as Promise<GmailTokens>;
}

// Get the Gmail account email from the token info
export async function getGmailEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_API}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get Gmail profile");
  const data = await res.json() as any;
  return data.emailAddress ?? "";
}

// ── Email fetching ────────────────────────────────────────────────────────────

const FINANCIAL_QUERY = [
  "category:primary",
  "(",
  "subject:transaction OR subject:payment OR subject:charge OR subject:purchase",
  "OR subject:deposit OR subject:withdrawal OR subject:receipt OR subject:alert",
  "OR subject:statement OR subject:transfer OR subject:invoice",
  ")",
].join(" ");

export interface GmailMessage {
  id: string;
  snippet: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
}

export async function fetchFinancialEmails(
  accessToken: string,
  since?: Date,
  maxResults = 25,
): Promise<GmailMessage[]> {
  let query = FINANCIAL_QUERY;
  if (since) {
    // Gmail uses epoch seconds in "after:" filter
    const epoch = Math.floor(since.getTime() / 1000);
    query += ` after:${epoch}`;
  }

  const listRes = await fetch(
    `${GMAIL_API}/messages?${new URLSearchParams({ q: query, maxResults: String(maxResults) })}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!listRes.ok) throw new Error("Gmail list request failed");
  const listData = await listRes.json() as any;
  const ids: string[] = (listData.messages ?? []).map((m: any) => m.id);

  if (ids.length === 0) return [];

  // Fetch full message payloads in parallel (batch of up to 25)
  const messages = await Promise.allSettled(
    ids.map(id => fetchMessage(accessToken, id)),
  );

  return messages
    .filter((r): r is PromiseFulfilledResult<GmailMessage> => r.status === "fulfilled")
    .map(r => r.value);
}

async function fetchMessage(accessToken: string, id: string): Promise<GmailMessage> {
  const res = await fetch(`${GMAIL_API}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch message ${id}`);
  const data = await res.json() as any;

  const headers: Record<string, string> = {};
  for (const h of data.payload?.headers ?? []) {
    headers[h.name.toLowerCase()] = h.value;
  }

  const body = extractBody(data.payload);

  return {
    id,
    snippet: data.snippet ?? "",
    subject: headers["subject"] ?? "",
    from: headers["from"] ?? "",
    date: new Date(parseInt(data.internalDate ?? "0")),
    body: body.slice(0, 2000), // cap to avoid huge prompts
  };
}

function extractBody(payload: any): string {
  if (!payload) return "";

  // Try plain text first, then HTML fallback
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  if (payload.body?.data) {
    const raw = Buffer.from(payload.body.data, "base64").toString("utf-8");
    // Strip HTML tags for plain text
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return "";
}

// ── AI-powered email parsing ──────────────────────────────────────────────────

export interface ParsedTransaction {
  isTransaction: boolean;
  type: "income" | "expense";
  amount: string;
  description: string;
  date: string; // ISO date string
  suggestedCategory: string;
  confidence: number; // 0–1
}

export async function parseEmailForTransaction(
  apiKey: string,
  email: GmailMessage,
): Promise<ParsedTransaction | null> {
  const prompt = `Analyze this financial email and extract transaction data. Reply with ONLY valid JSON matching the schema below — no markdown, no explanation.

Schema:
{
  "isTransaction": boolean,       // true if this email contains a real transaction
  "type": "income" | "expense",
  "amount": string,               // numeric string e.g. "45.99"
  "description": string,          // merchant name or short description
  "date": string,                 // ISO date YYYY-MM-DD
  "suggestedCategory": string,    // one of: Groceries, Dining, Transport, Utilities, Entertainment, Shopping, Health, Income, Transfer, Other
  "confidence": number            // 0.0 to 1.0
}

If the email does NOT contain an actual debit/credit transaction (e.g. it's a marketing email, low balance alert with no transaction, account statement summary), set "isTransaction": false and fill other fields with empty/zero values.

Email:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date.toISOString()}
Body: ${email.body || email.snippet}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "You are a financial transaction parser. You only reply with valid JSON, nothing else.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json() as any;
  const raw = data.content[0]?.text ?? "";

  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedTransaction;
    if (!parsed.isTransaction) return null;
    if (!parsed.amount || parseFloat(parsed.amount) <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}
