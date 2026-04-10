import { ENV } from "./_core/env";
import * as db from "./db";
import { fetchFinancialEmails, parseEmailForTransaction, refreshAccessToken } from "./gmail";

const INTERVAL_MS = 15 * 60 * 1000;

async function scanUser(token: Awaited<ReturnType<typeof db.getAllConnectedGmailUsers>>[number]) {
  if (!ENV.anthropicApiKey) return;
  let accessToken = token.accessToken;
  if (token.tokenExpiry && new Date() > token.tokenExpiry && token.refreshToken) {
    try {
      const fresh = await refreshAccessToken(token.refreshToken);
      await db.upsertOauthToken(token.userId, "gmail", {
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token ?? token.refreshToken,
        tokenExpiry: new Date(Date.now() + fresh.expires_in * 1000),
        providerEmail: token.providerEmail,
        lastScannedAt: token.lastScannedAt,
      });
      accessToken = fresh.access_token;
    } catch (err) {
      console.warn("[AutoScan] Token refresh failed for user " + token.userId + ":", err);
      return;
    }
  }
  const since = token.lastScannedAt ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let emails;
  try { emails = await fetchFinancialEmails(accessToken, since, 30); }
  catch (err) { console.warn("[AutoScan] Gmail fetch failed for user " + token.userId + ":", err); return; }
  let queued = 0;
  for (const email of emails) {
    const ref = "gmail_" + email.id;
    if (await db.isAlreadyQueued(token.userId, ref)) continue;
    const parsed = await parseEmailForTransaction(ENV.anthropicApiKey, email);
    if (!parsed) continue;
    const needsClassification =
      parsed.confidence < 0.65 ||
      parsed.suggestedCategory === "Other" ||
      !parsed.description ||
      parsed.description.trim().length < 3;
    await db.addToImportQueue({
      userId: token.userId,
      source: "gmail",
      externalRef: ref,
      amount: parsed.amount,
      transactionType: parsed.type,
      description: needsClassification ? "[?] " + (parsed.description || "Unknown transaction") : parsed.description,
      transactionDate: parsed.date ? new Date(parsed.date) : email.date,
      suggestedCategory: parsed.suggestedCategory,
      originalText: (email.subject + "\n" + email.snippet).slice(0, 500),
      confidence: String(parsed.confidence),
      status: "pending",
    });
    queued++;
  }
  await db.updateLastScanned(token.userId, "gmail");
  if (queued > 0) console.log("[AutoScan] user=" + token.userId + " queued " + queued + " new transaction(s)");
}

async function runAutoScan() {
  const tokens = await db.getAllConnectedGmailUsers();
  if (tokens.length === 0) return;
  console.log("[AutoScan] Scanning " + tokens.length + " connected Gmail account(s)...");
  await Promise.allSettled(tokens.map(scanUser));
}

export function startAutoScan() {
  if (!ENV.anthropicApiKey || !ENV.googleClientId) {
    console.log("[AutoScan] Skipped - ANTHROPIC_API_KEY or GOOGLE_CLIENT_ID not configured");
    return;
  }
  setTimeout(() => {
    runAutoScan().catch(err => console.warn("[AutoScan] Error:", err));
    setInterval(() => {
      runAutoScan().catch(err => console.warn("[AutoScan] Error:", err));
    }, INTERVAL_MS);
  }, 10_000);
  console.log("[AutoScan] Started - will scan Gmail every 15 minutes");
}
