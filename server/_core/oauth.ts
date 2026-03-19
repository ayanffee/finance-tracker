import type { Express } from "express";

// OAuth routes removed — authentication is handled via tRPC (auth.login / auth.register)
export function registerOAuthRoutes(_app: Express) {}
