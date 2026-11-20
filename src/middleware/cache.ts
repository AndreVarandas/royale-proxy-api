import type { MiddlewareHandler } from "hono";
import { LRUCache } from "lru-cache";

interface CachedResponse {
  body: ArrayBuffer;
  status: number;
  headers: [string, string][];
}

const SKIP_HEADERS = new Set([
  "set-cookie",
  "x-cache",
  "age",
  "connection",
  "transfer-encoding",
  "content-length",
]);

/**
 * Short-TTL in-memory response cache for GET requests, keyed by full URL.
 * Repeat requests are served without touching the upstream API, which both
 * speeds up responses and protects the shared key's rate quota.
 * Bounded by entry count and TTL so it can never grow without limit.
 */
export function responseCache(opts: { ttlMs: number; maxEntries: number }): MiddlewareHandler {
  if (opts.ttlMs <= 0) {
    return async (_c, next) => {
      await next();
    };
  }

  const cache = new LRUCache<string, CachedResponse>({
    max: opts.maxEntries,
    ttl: opts.ttlMs,
  });

  return async (c, next) => {
    if (c.req.method !== "GET") {
      await next();
      return;
    }

    const key = c.req.url;
    const hit = cache.get(key);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Cache", "HIT");
      const ageMs = opts.ttlMs - cache.getRemainingTTL(key);
      headers.set("Age", String(Math.max(0, Math.floor(ageMs / 1000))));
      return new Response(hit.body, { status: hit.status, headers });
    }

    await next();

    if (c.res.status === 200 && c.res.body) {
      const clone = c.res.clone();
      const body = await clone.arrayBuffer();
      const headers = [...clone.headers.entries()].filter(
        ([name]) => !SKIP_HEADERS.has(name.toLowerCase()),
      );
      cache.set(key, { body, status: clone.status, headers });
      c.res.headers.set("X-Cache", "MISS");
    }
  };
}
