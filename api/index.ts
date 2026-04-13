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
    app = express();

    registerPaystackWebhook(app);
    app.use(express.json({ limit: "5mb" }));
    app.use(express.urlencoded({ limit: "5mb", extended: true }));
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

  return app;
}

export default function handler(req: any, res: any) {
  const expressApp = getApp();
  if (!expressApp) {
    return res.status(500).json({ error: "Init failed", details: initError });
  }
  return expressApp(req, res);
}
