export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "dev-secret-change-me-in-production",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
};
