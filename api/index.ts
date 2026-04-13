let app: any;
let initError: string | null = null;

try {
  const express = await import("express");
  const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
  const { appRouter } = await import("../server/routers");
  const { createContext } = await import("../server/_core/context");
  const { registerOAuthRoutes, registerPaystackWebhook } = await import("../server/_core/oauth");
  const { apiRateLimit } = await import("../server/_core/rateLimit");

  app = express.default();

  registerPaystackWebhook(app);
  app.use(express.default.json({ limit: "5mb" }));
  app.use(express.default.urlencoded({ limit: "5mb", extended: true }));
  app.use(apiRateLimit);
  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
} catch (err: any) {
  initError = err?.stack || err?.message || String(err);
  console.error("INIT ERROR:", initError);
}

export default function handler(req: any, res: any) {
  if (initError) {
    return res.status(500).json({ error: "Init failed", details: initError });
  }
  return app(req, res);
}
