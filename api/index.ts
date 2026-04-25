// Use CommonJS require() for relative server imports so they resolve via
// Node's CJS resolver (which auto-adds .js extensions). Previously static
// `import` statements were being compiled to ESM, which refused to resolve
// ../server/routers without an explicit file extension.
//
// Every load is wrapped so that any failure surfaces as JSON instead of
// Vercel's opaque FUNCTION_INVOCATION_FAILED HTML page.

/* eslint-disable @typescript-eslint/no-var-requires */

let app: any = null;
let initError: string | null = null;

function getApp(): any {
  if (app) return app;
  if (initError) return null;

  try {
    const express = require("express");
    const { createExpressMiddleware } = require("@trpc/server/adapters/express");
    const { appRouter } = require("../server/routers");
    const { createContext } = require("../server/_core/context");
    const { registerOAuthRoutes, registerPaystackWebhook } = require("../server/_core/oauth");
    const { apiRateLimit } = require("../server/_core/rateLimit");

    const _app = express();
    registerPaystackWebhook(_app);
    _app.use(express.json({ limit: "5mb" }));
    _app.use(express.urlencoded({ limit: "5mb", extended: true }));
    _app.use(apiRateLimit);
    registerOAuthRoutes(_app);
    _app.use(
      "/api/trpc",
      createExpressMiddleware({ router: appRouter, createContext }),
    );

    app = _app;
  } catch (err: any) {
    initError = err?.stack || err?.message || String(err);
    // eslint-disable-next-line no-console
    console.error("API INIT ERROR:", initError);
  }

  return app;
}

export default function handler(req: any, res: any) {
  const expressApp = getApp();
  if (!expressApp) {
    res.setHeader("content-type", "application/json");
    res.statusCode = 500;
    res.end(
      JSON.stringify({ error: "API init failed", details: initError ?? "unknown" }),
    );
    return;
  }
  return expressApp(req, res);
}
