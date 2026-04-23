// Use dynamic imports so any module-load failure is captured in `initError`
// and surfaced as JSON instead of crashing the Lambda with
// FUNCTION_INVOCATION_FAILED + a Vercel HTML error page.

let app: any = null;
let initError: string | null = null;

const initPromise = (async () => {
  try {
    const expressMod: any = await import("express");
    const express = expressMod.default || expressMod;
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");
    const { registerOAuthRoutes, registerPaystackWebhook } = await import("../server/_core/oauth");
    const { apiRateLimit } = await import("../server/_core/rateLimit");

    const _app = express();
    registerPaystackWebhook(_app);
    _app.use(express.json({ limit: "5mb" }));
    _app.use(express.urlencoded({ limit: "5mb", extended: true }));
    _app.use(apiRateLimit);
    registerOAuthRoutes(_app);
    _app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      }),
    );
    app = _app;
  } catch (err: any) {
    initError = err?.stack || err?.message || String(err);
    // eslint-disable-next-line no-console
    console.error("API INIT ERROR:", initError);
  }
})();

export default async function handler(req: any, res: any) {
  try {
    await initPromise;
  } catch (err: any) {
    initError = initError || err?.stack || err?.message || String(err);
  }

  if (!app) {
    res.setHeader("content-type", "application/json");
    return res.status(500).end(
      JSON.stringify({ error: "API init failed", details: initError ?? "unknown" }),
    );
  }
  return app(req, res);
}
