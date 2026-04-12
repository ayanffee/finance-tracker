import type { Request, Response, NextFunction } from "express";

/**
 * Lightweight in-memory rate limiter.
 * For serverless (Vercel), each instance has its own window — this still protects
 * against burst abuse within a single instance. For stricter global limits,
 * swap this for Redis-backed rate limiting (e.g., @upstash/ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}, 60_000);

export function rateLimit(opts: {
  windowMs?: number;  // Time window in ms (default: 60s)
  max?: number;       // Max requests per window (default: 60)
  keyFn?: (req: Request) => string; // Custom key extractor
}) {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 60;
  const keyFn = opts.keyFn ?? ((req: Request) => {
    // Use X-Forwarded-For (Vercel/proxied) or fallback to IP
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.ip ?? "unknown";
    return ip;
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

// Stricter limiter for expensive operations (AI calls)
export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10, // 10 AI requests per minute per IP
});

// General API limiter
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120, // 120 requests per minute per IP
});
