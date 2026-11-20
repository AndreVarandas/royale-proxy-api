import type { MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { clientIp } from "../lib/client-ip.js";

/**
 * Per-IP rate limiting with an in-memory store — protects the shared
 * Supercell key quota from being drained by any single caller.
 */
export function ipRateLimit(opts: {
  windowMs: number;
  max: number;
  trustProxy: boolean;
}): MiddlewareHandler {
  return rateLimiter({
    windowMs: opts.windowMs,
    limit: opts.max,
    standardHeaders: "draft-6",
    keyGenerator: (c) => clientIp(c, opts.trustProxy),
    message: { message: "Too many requests. Please slow down and retry later." },
  });
}
