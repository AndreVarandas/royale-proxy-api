import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";
import { rateLimiter } from "hono-rate-limiter";

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const first = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (first) return first;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // No socket info (e.g. in-process app.request() in tests).
    return "unknown";
  }
}

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
