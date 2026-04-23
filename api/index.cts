import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes, registerPaystackWebhook } from "../server/_core/oauth";
import { apiRateLimit } from "../server/_core/rateLimit";

let app: ReturnType<typeof express> | null = null;
let initError: string | null = null;

function getApp() {
  if (app) return app;
  if (initError) return null;

  try {
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

  return app;
}

export default function handler(req: any, res: any) {
  const expressApp = getApp();
  if (!expressApp) {
    res.setHeader("content-type", "application/json");
    res.statusCode = 500;
    res.end(
      JSON.stringify({
        error: "API init failed",
        details: initError ?? "unknown",
      }),
    );
    return;
  }
  return expressApp(req, res);
}
