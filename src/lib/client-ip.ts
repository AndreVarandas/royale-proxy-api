import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";

/**
 * Caller IP used for rate-limit keys and request logs. X-Forwarded-For is only
 * honored when TRUST_PROXY is set (otherwise clients could spoof it).
 */
export function clientIp(c: Context, trustProxy: boolean): string {
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
