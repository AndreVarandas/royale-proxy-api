import { createHash } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { clientIp } from "../lib/client-ip.js";
import type { Logger } from "../lib/logger.js";
import type { Metrics } from "../lib/metrics.js";

export type IpMode = "omit" | "hash" | "full";

function formatIp(ip: string, mode: IpMode): string | undefined {
  if (mode === "omit") return undefined;
  if (mode === "full") return ip;
  return createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

/**
 * One JSON log line per request (and metrics observation). Registered first in
 * the stack so rate-limited and auth-rejected requests are logged too. Never
 * logs Authorization headers or query strings; caller IPs follow LOG_IP_MODE.
 */
export function requestLog(opts: {
  logger: Logger;
  ipMode: IpMode;
  trustProxy: boolean;
  metrics?: Metrics;
}): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();

    const status = c.res.status;
    const cache = c.res.headers.get("x-cache");
    // Most specific matched route pattern (middleware registers as "ALL").
    const route =
      [...c.req.matchedRoutes].reverse().find((r) => r.method !== "ALL")?.path ?? c.req.path;

    const fields: Record<string, unknown> = {
      method: c.req.method,
      path: c.req.path,
      route,
      status,
      durationMs: Math.round(performance.now() - start),
    };
    if (cache) fields.cache = cache;
    const ip = formatIp(clientIp(c, opts.trustProxy), opts.ipMode);
    if (ip !== undefined) fields.ip = ip;

    opts.logger.info(fields);
    opts.metrics?.observeRequest(status, cache);
  };
}
