import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerOAuthRoutes, registerPaystackWebhook } from "../server/_core/oauth";
import { apiRateLimit } from "../server/_core/rateLimit";

const app = express();

// Paystack webhook MUST be before body parsers (needs raw body for HMAC)
registerPaystackWebhook(app);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb", extended: true }));
app.use(apiRateLimit);

// OAuth callbacks + SMS webhook
registerOAuthRoutes(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
