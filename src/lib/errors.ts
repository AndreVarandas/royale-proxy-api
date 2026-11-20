import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { UpstreamTimeoutError } from "./upstream.js";

interface UpstreamErrorShape {
  response?: {
    status?: number;
    data?: { reason?: unknown; message?: unknown };
  };
  code?: string;
}

function upstreamDetail(data: UpstreamErrorShape["response"]): string | undefined {
  const message = data?.data?.message;
  if (typeof message === "string" && message.length > 0) return message;
  const reason = data?.data?.reason;
  if (typeof reason === "string" && reason.length > 0) return reason;
  return undefined;
}

/**
 * Normalize any thrown error into an HTTPException with a safe, useful JSON
 * message. Upstream error bodies are never dumped verbatim; only the
 * `message`/`reason` fields are surfaced.
 */
export function toHttpException(error: unknown): HTTPException {
  if (error instanceof HTTPException) return error;
  if (error instanceof UpstreamTimeoutError) {
    return new HTTPException(504, { message: error.message });
  }

  const e = (error ?? {}) as UpstreamErrorShape;
  const status = e.response?.status;

  if (typeof status === "number" && status >= 400 && status < 600) {
    if (status === 403) {
      return new HTTPException(403, {
        message:
          "The Clash Royale API denied access (403). Check that CLASH_ROYALE_API_TOKEN is valid and whitelisted for this server's IP.",
      });
    }
    if (status === 429) {
      return new HTTPException(429, {
        message: "Rate limited by the Clash Royale API. Slow down and retry shortly.",
      });
    }
    if (status < 500) {
      return new HTTPException(status as ContentfulStatusCode, {
        message: upstreamDetail(e.response) ?? "The Clash Royale API rejected the request",
      });
    }
    return new HTTPException(502, { message: "The Clash Royale API returned an error" });
  }

  if (e.code === "ECONNABORTED" || e.code === "ETIMEDOUT") {
    return new HTTPException(504, { message: "The Clash Royale API timed out" });
  }

  return new HTTPException(502, { message: "Could not reach the Clash Royale API" });
}
