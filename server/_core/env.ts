export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-me-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Google OAuth — for Gmail auto-import
  // Get credentials at: console.cloud.google.com → APIs & Services → Credentials
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/oauth/gmail/callback",
  // Webhook secret — authenticates incoming SMS POST requests
  webhookSecret: process.env.WEBHOOK_SECRET ?? "dev-webhook-secret",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  // Paystack billing
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY ?? "",
  paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY ?? "",
  paystackPlanCodeNgn: process.env.PAYSTACK_PLAN_CODE_NGN ?? "", // Created via Paystack dashboard or API
  paystackPlanCodeUsd: process.env.PAYSTACK_PLAN_CODE_USD ?? "",
};
